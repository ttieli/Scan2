import { describe, expect, it } from 'vitest';
import { ClassicTransferReceiver } from '@/lib/classic_transfer_receiver';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function makeV2(kind: 't' | 'f', bytes: Uint8Array) {
  const hash = await sha256Hex(bytes);
  const id = hash.slice(0, 16);
  const base64 = toBase64(bytes);
  const chunks = [base64.slice(0, Math.ceil(base64.length / 2)), base64.slice(Math.ceil(base64.length / 2))];
  const metadata = kind === 't'
    ? { h: hash, e: 'utf8' }
    : { n: 'classic.bin', y: 'application/octet-stream', s: bytes.length, h: hash };
  return [
    JSON.stringify({ v:2,k:kind,x:id,i:0,t:3,d:'',m:metadata }),
    JSON.stringify({ v:2,k:kind,x:id,i:1,t:3,d:chunks[0] }),
    JSON.stringify({ v:2,k:kind,x:id,i:2,t:3,d:chunks[1] }),
  ];
}

async function makeQ3F(bytes: Uint8Array): Promise<string[]> {
  const hash = await sha256Hex(bytes);
  const metadataBytes = new TextEncoder().encode(JSON.stringify({
    n:'uniform.bin',y:'application/octet-stream',s:bytes.length,h:hash,
  }));
  const object = new Uint8Array(4 + metadataBytes.length + bytes.length);
  new DataView(object.buffer).setUint32(0, metadataBytes.length, false);
  object.set(metadataBytes, 4);
  object.set(bytes, 4 + metadataBytes.length);
  const chunkSize = 24;
  const total = Math.ceil(object.length / chunkSize);
  const id = hash.slice(0, 16);
  return Array.from({length:total}, (_, index) => {
    const chunk = new Uint8Array(chunkSize);
    chunk.set(object.slice(index * chunkSize, (index + 1) * chunkSize));
    const data = btoa(String.fromCharCode(...chunk)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return `Q3F${id}${index.toString(36).padStart(5,'0')}${total.toString(36).padStart(5,'0')}${object.length.toString(36).padStart(8,'0')}${data}`;
  });
}

describe('classic sender compatibility in enhanced receiver', () => {
  it('reassembles V2 private text out of order', async () => {
    const text = '经典 V2 文本🙂'.repeat(20);
    const fragments = await makeV2('t', new TextEncoder().encode(text));
    const receiver = new ClassicTransferReceiver();
    await receiver.accept(fragments[1]!);
    await receiver.accept(fragments[0]!);
    const result = await receiver.accept(fragments[2]!);
    expect(result.type).toBe('complete');
    expect(result.type === 'complete' && result.text).toBe(text);
    expect(receiver.snapshot()?.protocol).toBe('classic-v2');
  });

  it('reassembles and verifies a V2 file', async () => {
    const bytes = new Uint8Array(513);
    for (let index=0; index<bytes.length; index++) bytes[index]=(index*17+3)&0xff;
    const fragments = await makeV2('f', bytes);
    const receiver = new ClassicTransferReceiver();
    await receiver.accept(fragments[2]!);
    await receiver.accept(fragments[0]!);
    const result = await receiver.accept(fragments[1]!);
    expect(result.type).toBe('complete');
    expect(result.type === 'complete' && Array.from(result.data!)).toEqual(Array.from(bytes));
    expect(result.type === 'complete' && result.filename).toBe('classic.bin');
  });

  it('reassembles current Q3F classic files', async () => {
    const bytes = new TextEncoder().encode('uniform classic file'.repeat(30));
    const fragments = await makeQ3F(bytes);
    const receiver = new ClassicTransferReceiver();
    for (const fragment of fragments.slice().reverse()) await receiver.accept(fragment);
    const result = receiver.lastResult();
    expect(result?.type).toBe('complete');
    expect(result?.type === 'complete' && Array.from(result.data!)).toEqual(Array.from(bytes));
    expect(receiver.snapshot()?.protocol).toBe('classic-q3f');
  });

  it('reports duplicate and missing numeric ranges for classic senders', async () => {
    const fragments = await makeV2('f', new TextEncoder().encode('missing test'));
    const receiver = new ClassicTransferReceiver();
    await receiver.accept(fragments[0]!);
    const duplicate = await receiver.accept(fragments[0]!);
    expect(duplicate.type).toBe('progress');
    expect(duplicate.type === 'progress' && duplicate.duplicate).toBe(true);
    expect(receiver.recoveryRequest()).toEqual({ code:'2-3', missingCount:2, requestKind:'classic-numbers' });
  });

  it('rejects cross-transfer fragments and corrupted content', async () => {
    const first = await makeV2('f', new TextEncoder().encode('first'));
    const second = await makeV2('f', new TextEncoder().encode('second'));
    const receiver = new ClassicTransferReceiver();
    await receiver.accept(first[0]!);
    await expect(receiver.accept(second[1]!)).rejects.toThrow('different classic transfer');

    const damaged = await makeV2('f', new TextEncoder().encode('digest protected'));
    const parsed = JSON.parse(damaged[2]!);
    parsed.d = parsed.d.replace(/.$/, parsed.d.endsWith('A') ? 'B' : 'A');
    damaged[2] = JSON.stringify(parsed);
    const damagedReceiver = new ClassicTransferReceiver();
    await damagedReceiver.accept(damaged[0]!);
    await damagedReceiver.accept(damaged[1]!);
    await expect(damagedReceiver.accept(damaged[2]!)).rejects.toThrow();
  });

  it('keeps large classic progress bounded to 200 buckets', async () => {
    const receiver = new ClassicTransferReceiver();
    const result = await receiver.accept(JSON.stringify({
      v:2,k:'f',x:'0123456789abcdef',i:54321,t:100000,d:'QQ==',
    }));
    expect(result.type).toBe('progress');
    expect(result.type === 'progress' && result.snapshot.received).toBe(1);
    expect(result.type === 'progress' && result.snapshot.buckets.length).toBe(200);
  });

  it('rejects conflicting duplicates instead of overwriting state', async () => {
    const fragments = await makeV2('f', new TextEncoder().encode('duplicate integrity'));
    const receiver = new ClassicTransferReceiver();
    await receiver.accept(fragments[0]!);
    const conflictingMetadata = JSON.parse(fragments[0]!);
    conflictingMetadata.m.n = 'other.bin';
    await expect(receiver.accept(JSON.stringify(conflictingMetadata))).rejects.toThrow('conflicting duplicate');
    await receiver.accept(fragments[1]!);
    const conflictingData = JSON.parse(fragments[1]!);
    conflictingData.d = (conflictingData.d[0] === 'A' ? 'B' : 'A') + conflictingData.d.slice(1);
    await expect(receiver.accept(JSON.stringify(conflictingData))).rejects.toThrow('conflicting duplicate');
  });
});
