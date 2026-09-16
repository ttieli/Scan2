export type ClassicProtocol = 'classic-v2' | 'classic-q3f';

type ClassicKind = 't' | 'f';
type FileMetadata = { n: string; y: string; s: number; h: string };
type TextMetadata = { h: string; e: 'utf8' };
type ClassicMetadata = FileMetadata | TextMetadata;

type ParsedClassicFragment = {
  protocol: ClassicProtocol;
  id: string;
  kind: ClassicKind;
  index: number;
  total: number;
  data: string;
  metadata: ClassicMetadata | null;
  objectLength?: number;
  rawChunkSize?: number;
};

type ClassicState = {
  protocol: ClassicProtocol;
  id: string;
  kind: ClassicKind;
  total: number;
  fragments: Map<number, string>;
  receivedBits: Uint8Array;
  receivedCount: number;
  bucketReceived: Uint32Array;
  bucketTotals: Uint32Array;
  metadata: ClassicMetadata | null;
  objectLength?: number;
  rawChunkSize?: number;
};

export type ClassicSnapshot = {
  protocol: ClassicProtocol;
  id: string;
  kind: ClassicKind;
  total: number;
  received: number;
  missingCount: number;
  buckets: Array<{ received: number; total: number }>;
};

export type ClassicProgressResult = {
  type: 'progress';
  duplicate: boolean;
  snapshot: ClassicSnapshot;
};

export type ClassicCompleteResult = {
  type: 'complete';
  protocol: ClassicProtocol;
  isText: boolean;
  text?: string;
  data?: Uint8Array;
  filename?: string;
  mime?: string;
  sha256: string;
  snapshot: ClassicSnapshot;
};

export type ClassicAcceptResult = ClassicProgressResult | ClassicCompleteResult | { type: 'unsupported' };

const Q3F_MAGIC = 'Q3F';
const Q3F_HEADER_LENGTH = 37;
const MAX_OBJECT_BYTES = 21 * 1024 * 1024;
const MAX_FRAGMENTS = 1_000_000;

export class ClassicTransferReceiver {
  private state: ClassicState | null = null;
  private completed: ClassicCompleteResult | null = null;

  reset(): void {
    this.state = null;
    this.completed = null;
  }

  snapshot(): ClassicSnapshot | null {
    return this.state ? snapshotState(this.state) : null;
  }

  lastResult(): ClassicCompleteResult | null {
    return this.completed;
  }

  recoveryRequest(): { code: string; missingCount: number; requestKind: 'classic-numbers' } {
    if (!this.state) return { code:'', missingCount:0, requestKind:'classic-numbers' };
    const missing: number[] = [];
    for (let index=0; index<this.state.total; index++) {
      if (!hasReceived(this.state.receivedBits,index)) missing.push(index + 1);
    }
    return { code:formatNumberRanges(missing), missingCount:missing.length, requestKind:'classic-numbers' };
  }

  async accept(value: string): Promise<ClassicAcceptResult> {
    const fragment = parseClassicFragment(stripBom(value));
    if (!fragment) return { type:'unsupported' };
    if (!this.state) this.state = createState(fragment);
    assertSameTransfer(this.state, fragment);

    const duplicate = hasReceived(this.state.receivedBits,fragment.index);
    if (duplicate && this.state.fragments.get(fragment.index) !== fragment.data) {
      throw new Error('Received a conflicting duplicate classic fragment');
    }
    if (fragment.metadata && this.state.metadata && JSON.stringify(fragment.metadata) !== JSON.stringify(this.state.metadata)) {
      throw new Error('Received conflicting duplicate classic metadata');
    }
    if (!duplicate) {
      this.state.fragments.set(fragment.index,fragment.data);
      markReceived(this.state.receivedBits,fragment.index);
      this.state.receivedCount++;
      const bucket=Math.min(this.state.bucketReceived.length-1,Math.floor(fragment.index*this.state.bucketReceived.length/this.state.total));
      this.state.bucketReceived[bucket]++;
    }
    if (fragment.metadata) this.state.metadata = structuredClone(fragment.metadata);
    const snapshot = snapshotState(this.state);
    if (snapshot.received !== snapshot.total) return { type:'progress', duplicate, snapshot };

    this.completed = await completeState(this.state);
    return this.completed;
  }
}

function parseClassicFragment(value: string): ParsedClassicFragment | null {
  if (value.startsWith(Q3F_MAGIC)) return parseQ3F(value);
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const fragment = parsed as Record<string, unknown>;
  if (fragment.v !== 2 || (fragment.k !== 't' && fragment.k !== 'f')) return null;
  if (typeof fragment.x !== 'string' || !/^[0-9a-f]{16}$/.test(fragment.x)) throw new Error('Invalid classic V2 transfer ID');
  if (!Number.isInteger(fragment.i) || !Number.isInteger(fragment.t)) throw new Error('Invalid classic V2 fragment index');
  const index = fragment.i as number;
  const total = fragment.t as number;
  if (total < 2 || total > MAX_FRAGMENTS || index < 0 || index >= total) throw new Error('Invalid classic V2 fragment range');
  if (typeof fragment.d !== 'string') throw new Error('Invalid classic V2 data');
  let metadata: ClassicMetadata | null = null;
  if (index === 0) {
    metadata = validateMetadata(fragment.k, fragment.m);
    if (fragment.d !== '') throw new Error('Invalid classic V2 metadata data');
  } else if (fragment.m !== undefined) {
    throw new Error('Unexpected classic V2 metadata');
  }
  return { protocol:'classic-v2',id:fragment.x,kind:fragment.k,index,total,data:fragment.d,metadata };
}

function parseQ3F(value: string): ParsedClassicFragment {
  if (value.length <= Q3F_HEADER_LENGTH) throw new Error('Invalid Q3F packet');
  const id = value.slice(3,19);
  const index = parseFixedBase36(value.slice(19,24));
  const total = parseFixedBase36(value.slice(24,29));
  const objectLength = parseFixedBase36(value.slice(29,37));
  if (!/^[0-9a-f]{16}$/.test(id) || total < 1 || total > MAX_FRAGMENTS || index < 0 || index >= total || objectLength < 4 || objectLength > MAX_OBJECT_BYTES) {
    throw new Error('Invalid Q3F header');
  }
  const data = value.slice(Q3F_HEADER_LENGTH);
  const rawChunkSize = decodeBase64Url(data).length;
  if (rawChunkSize < 1 || objectLength > total * rawChunkSize || objectLength <= (total - 1) * rawChunkSize) {
    throw new Error('Invalid Q3F length');
  }
  return { protocol:'classic-q3f',id,kind:'f',index,total,data,metadata:null,objectLength,rawChunkSize };
}

function createState(fragment: ParsedClassicFragment): ClassicState {
  const bucketCount=Math.max(1,Math.min(fragment.total,200));
  const bucketTotals=new Uint32Array(bucketCount);
  for(let bucket=0;bucket<bucketCount;bucket++){
    const start=Math.floor(bucket*fragment.total/bucketCount);
    const end=Math.floor((bucket+1)*fragment.total/bucketCount);
    bucketTotals[bucket]=Math.max(1,end-start);
  }
  return {
    protocol:fragment.protocol,id:fragment.id,kind:fragment.kind,total:fragment.total,
    fragments:new Map(),receivedBits:new Uint8Array(Math.ceil(fragment.total/8)),receivedCount:0,
    bucketReceived:new Uint32Array(bucketCount),bucketTotals,metadata:fragment.metadata,
    objectLength:fragment.objectLength,rawChunkSize:fragment.rawChunkSize,
  };
}

function assertSameTransfer(state: ClassicState, fragment: ParsedClassicFragment): void {
  if (state.protocol !== fragment.protocol || state.id !== fragment.id || state.kind !== fragment.kind || state.total !== fragment.total ||
      state.objectLength !== fragment.objectLength || state.rawChunkSize !== fragment.rawChunkSize) {
    throw new Error('Received a fragment from a different classic transfer');
  }
}

async function completeState(state: ClassicState): Promise<ClassicCompleteResult> {
  return state.protocol === 'classic-v2' ? completeV2(state) : completeQ3F(state);
}

async function completeV2(state: ClassicState): Promise<ClassicCompleteResult> {
  if (!state.metadata) throw new Error('Classic V2 metadata is missing');
  let base64 = '';
  for (let index=1; index<state.total; index++) base64 += requiredFragment(state,index);
  const bytes = decodeBase64(base64);
  return verifyAndBuildResult(state, state.metadata, bytes);
}

async function completeQ3F(state: ClassicState): Promise<ClassicCompleteResult> {
  const rawChunkSize = state.rawChunkSize!;
  const padded = new Uint8Array(state.total * rawChunkSize);
  for (let index=0; index<state.total; index++) {
    const chunk = decodeBase64Url(requiredFragment(state,index));
    if (chunk.length !== rawChunkSize) throw new Error('Q3F chunk size mismatch');
    padded.set(chunk,index*rawChunkSize);
  }
  const object = padded.slice(0,state.objectLength!);
  const metadataLength = new DataView(object.buffer,object.byteOffset,object.byteLength).getUint32(0,false);
  if (metadataLength < 2 || 4 + metadataLength > object.length) throw new Error('Q3F metadata length mismatch');
  const metadata = validateMetadata('f',JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(object.slice(4,4+metadataLength))));
  const bytes = object.slice(4+metadataLength);
  return verifyAndBuildResult(state,metadata,bytes);
}

async function verifyAndBuildResult(state: ClassicState, metadata: ClassicMetadata, bytes: Uint8Array): Promise<ClassicCompleteResult> {
  if (state.kind === 'f' && bytes.length !== (metadata as FileMetadata).s) throw new Error('Classic file size mismatch');
  const hash = await sha256Hex(bytes);
  if (hash !== metadata.h) throw new Error('Classic SHA-256 mismatch');
  const snapshot = snapshotState(state);
  if (state.kind === 't') {
    const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return {type:'complete',protocol:state.protocol,isText:true,text,sha256:hash,snapshot};
  }
  const file = metadata as FileMetadata;
  return {type:'complete',protocol:state.protocol,isText:false,data:bytes,filename:file.n,mime:file.y,sha256:hash,snapshot};
}

function validateMetadata(kind: unknown, value: unknown): ClassicMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid classic metadata');
  const metadata = value as Record<string, unknown>;
  if (typeof metadata.h !== 'string' || !/^[0-9a-f]{64}$/.test(metadata.h)) throw new Error('Invalid classic SHA-256');
  if (kind === 't') {
    if (metadata.e !== 'utf8') throw new Error('Invalid classic text encoding');
    return {h:metadata.h,e:'utf8'};
  }
  if (typeof metadata.n !== 'string' || !metadata.n || typeof metadata.y !== 'string' || !Number.isInteger(metadata.s) || (metadata.s as number) < 0) {
    throw new Error('Invalid classic file metadata');
  }
  return {n:metadata.n,y:metadata.y,s:metadata.s as number,h:metadata.h};
}

function snapshotState(state: ClassicState): ClassicSnapshot {
  const buckets=Array.from(state.bucketReceived,(received,index)=>({received,total:state.bucketTotals[index]??0}));
  return {protocol:state.protocol,id:state.id,kind:state.kind,total:state.total,received:state.receivedCount,
    missingCount:Math.max(0,state.total-state.receivedCount),buckets};
}

function requiredFragment(state: ClassicState,index: number): string {
  const value=state.fragments.get(index);
  if(value===undefined)throw new Error(`Classic fragment ${index+1} is missing`);
  return value;
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid classic base64');
  const binary=atob(value);const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return bytes;
}

function decodeBase64Url(value: string): Uint8Array {
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid Q3F base64url');
  const base64=value.replace(/-/g,'+').replace(/_/g,'/');
  return decodeBase64(base64+'='.repeat((4-base64.length%4)%4));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return Array.from(digest,(value)=>value.toString(16).padStart(2,'0')).join('');
}

function parseFixedBase36(value: string): number {
  if(!/^[0-9a-z]+$/.test(value))throw new Error('Invalid Q3F base36');
  return Number.parseInt(value,36);
}

function stripBom(value: string): string {
  return value.charCodeAt(0)===0xfeff?value.slice(1):value;
}

function formatNumberRanges(values: number[]): string {
  if(!values.length)return '';
  const parts:string[]=[];let start=values[0]!;let previous=start;
  for(let index=1;index<=values.length;index++){
    const current=values[index];
    if(current===previous+1){previous=current;continue;}
    parts.push(start===previous?String(start):`${start}-${previous}`);
    start=current!;previous=current!;
  }
  return parts.join(', ');
}

function hasReceived(bits: Uint8Array,index: number): boolean {
  return (bits[index>>3]!&(1<<(index&7)))!==0;
}

function markReceived(bits: Uint8Array,index: number): void {
  bits[index>>3]=bits[index>>3]!|(1<<(index&7));
}
