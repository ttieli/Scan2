import { describe, expect, it } from 'vitest';
import {
  unwrapAndVerifyIntegrityEnvelope,
  wrapIntegrityEnvelope,
} from '@/lib/integrity_envelope';
import { packetizeRaptorQ } from '@raptorqr/core/sender/raptorq_packetizer';
import { RaptorQWasmDecoder } from '@raptorqr/core/fec/raptorq_wasm';
import { parsePacket } from '@raptorqr/core/protocol/packet';
import { inflateSync } from 'fflate';

describe('enhanced transfer integrity envelope', () => {
  it('round-trips file bytes, UTF-8 filename and MIME with SHA-256', async () => {
    const data = new Uint8Array(2048);
    for (let index = 0; index < data.length; index++) data[index] = (index * 29 + 7) & 0xff;
    const wrapped = await wrapIntegrityEnvelope(
      data,
      false,
      '校验文件🙂.bin',
      'application/octet-stream',
    );
    const result = await unwrapAndVerifyIntegrityEnvelope(wrapped);
    expect(result.isText).toBe(false);
    expect(result.filename).toBe('校验文件🙂.bin');
    expect(result.mime).toBe('application/octet-stream');
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.from(result.data)).toEqual(Array.from(data));
  });

  it('round-trips private text without file metadata', async () => {
    const data = new TextEncoder().encode('增强文本🙂'.repeat(40));
    const wrapped = await wrapIntegrityEnvelope(data, true);
    const result = await unwrapAndVerifyIntegrityEnvelope(wrapped);
    expect(result.isText).toBe(true);
    expect(result.filename).toBe('');
    expect(result.mime).toBe('text/plain;charset=utf-8');
    expect(new TextDecoder().decode(result.data)).toBe('增强文本🙂'.repeat(40));
  });

  it('rejects a one-byte body mutation before exposing data', async () => {
    const wrapped = await wrapIntegrityEnvelope(new TextEncoder().encode('sensitive payload'), false, 'x.txt', 'text/plain');
    wrapped[wrapped.length - 1] ^= 0x01;
    await expect(unwrapAndVerifyIntegrityEnvelope(wrapped)).rejects.toThrow('SHA-256 mismatch');
  });

  it('rejects truncated and inconsistent envelopes', async () => {
    await expect(unwrapAndVerifyIntegrityEnvelope(new Uint8Array([1, 2, 3]))).rejects.toThrow('truncated');
    const wrapped = await wrapIntegrityEnvelope(new Uint8Array([1, 2, 3]), false, 'x.bin', 'application/octet-stream');
    wrapped[6] = 0xff;
    wrapped[7] = 0xff;
    wrapped[8] = 0xff;
    wrapped[9] = 0xff;
    await expect(unwrapAndVerifyIntegrityEnvelope(wrapped)).rejects.toThrow('length');
  });

  it('survives unordered packet loss through RaptorQ and still verifies SHA-256', async () => {
    const original = new Uint8Array(16_384);
    for (let index = 0; index < original.length; index++) original[index] = (index * 37 + 11) & 0xff;
    const envelope = await wrapIntegrityEnvelope(original, false, 'loss-test.bin', 'application/octet-stream');
    const encoded = await packetizeRaptorQ(envelope, false, true, undefined, undefined, {
      maxTransportPayloadSize: 256,
      repairPercent: 30,
    });
    const decoder = await RaptorQWasmDecoder.create(encoded.dataLength, encoded.symbolSize);
    let restored: Uint8Array | null = null;
    const surviving = encoded.packets.filter((_, index) => index % 10 !== 0).reverse();
    for (const transport of surviving) {
      restored = decoder.push(parsePacket(transport).payload);
      if (restored) break;
    }
    expect(restored).not.toBeNull();
    const verified = await unwrapAndVerifyIntegrityEnvelope(
      encoded.isCompressed ? inflateSync(restored!) : restored!,
    );
    expect(Array.from(verified.data)).toEqual(Array.from(original));
    expect(verified.filename).toBe('loss-test.bin');
  });
});
