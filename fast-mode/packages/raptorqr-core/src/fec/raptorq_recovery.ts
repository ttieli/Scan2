import { RAPTORQ_SYMBOL_INDEX } from '../protocol/constants';
import { parsePacket } from '../protocol/packet';

const PAYLOAD_ID_BYTES = 4;
const MAX_SOURCE_SYMBOLS_PER_BLOCK = 56_403;
const REQUEST_PREFIX = 'RQ1';

export interface RaptorQSourceLayout {
  totalSourceSymbols: number;
  blockSourceCounts: number[];
  blockOffsets: number[];
}

export interface RaptorQProgressBucket {
  received: number;
  total: number;
}

export interface RaptorQSourceProgress {
  sourceTotal: number;
  sourceReceived: number;
  missingSourceIds: string[];
  buckets: RaptorQProgressBucket[];
}

export interface RaptorQRecoveryRequest {
  dataLength: number;
  symbolSize: number;
  missingIds: Set<string>;
}

export function sourceLayoutForRaptorQ(
  dataLength: number,
  transportPayloadSize: number,
): RaptorQSourceLayout {
  if (!Number.isInteger(dataLength) || dataLength < 0) throw new RangeError('Invalid RaptorQ data length');
  const sourceSymbolSize = transportPayloadSize - PAYLOAD_ID_BYTES;
  if (!Number.isInteger(sourceSymbolSize) || sourceSymbolSize <= 0) {
    throw new RangeError('Invalid RaptorQ symbol size');
  }
  const totalSourceSymbols = Math.max(1, Math.ceil(dataLength / sourceSymbolSize));
  const blockCount = Math.max(1, Math.ceil(totalSourceSymbols / MAX_SOURCE_SYMBOLS_PER_BLOCK));
  const largestBlock = Math.ceil(totalSourceSymbols / blockCount);
  const smallestBlock = largestBlock - 1;
  const largerBlockCount = totalSourceSymbols - smallestBlock * blockCount;
  const blockSourceCounts = Array.from({ length: blockCount }, (_, block) =>
    block < largerBlockCount ? largestBlock : smallestBlock,
  );
  const blockOffsets: number[] = [];
  let offset = 0;
  for (const count of blockSourceCounts) {
    blockOffsets.push(offset);
    offset += count;
  }
  return { totalSourceSymbols, blockSourceCounts, blockOffsets };
}

export function raptorQPayloadId(payload: Uint8Array): string {
  const { sourceBlock, encodingSymbolId } = parsePayloadId(payload);
  return `${sourceBlock}:${encodingSymbolId}`;
}

export function raptorQSourceOrdinal(
  payload: Uint8Array,
  dataLength: number,
  symbolSize: number,
): number | null {
  const layout = sourceLayoutForRaptorQ(dataLength, symbolSize);
  const { sourceBlock, encodingSymbolId } = parsePayloadId(payload);
  const count = layout.blockSourceCounts[sourceBlock];
  if (count === undefined || encodingSymbolId >= count) return null;
  return layout.blockOffsets[sourceBlock]! + encodingSymbolId;
}

export function createRaptorQSourceProgress(
  receivedIds: ReadonlySet<string>,
  dataLength: number,
  symbolSize: number,
  maxBuckets = 200,
): RaptorQSourceProgress {
  const layout = sourceLayoutForRaptorQ(dataLength, symbolSize);
  const bucketCount = Math.max(1, Math.min(layout.totalSourceSymbols, Math.floor(maxBuckets)));
  const buckets = Array.from({ length: bucketCount }, () => ({ received: 0, total: 0 }));
  const missingSourceIds: string[] = [];
  let sourceReceived = 0;
  let ordinal = 0;

  layout.blockSourceCounts.forEach((count, sourceBlock) => {
    for (let esi = 0; esi < count; esi++, ordinal++) {
      const bucket = Math.min(bucketCount - 1, Math.floor(ordinal * bucketCount / layout.totalSourceSymbols));
      buckets[bucket]!.total++;
      const id = `${sourceBlock}:${esi}`;
      if (receivedIds.has(id)) {
        sourceReceived++;
        buckets[bucket]!.received++;
      } else {
        missingSourceIds.push(id);
      }
    }
  });

  return { sourceTotal: layout.totalSourceSymbols, sourceReceived, missingSourceIds, buckets };
}

export function buildRaptorQRecoveryRequest(
  dataLength: number,
  symbolSize: number,
  missingIds: readonly string[],
): string {
  const layout = sourceLayoutForRaptorQ(dataLength, symbolSize);
  const groups = new Map<number, number[]>();
  for (const id of missingIds) {
    const [blockText, esiText, extra] = id.split(':');
    const block = Number(blockText);
    const esi = Number(esiText);
    if (extra !== undefined || !Number.isInteger(block) || block < 0 || !Number.isInteger(esi) || esi < 0) {
      throw new Error(`Invalid RaptorQ payload ID: ${id}`);
    }
    validateSourceSymbol(layout, block, esi);
    const values = groups.get(block) ?? [];
    values.push(esi);
    groups.set(block, values);
  }
  const body = [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([block, values]) => `${block.toString(36)}=${formatRanges(values)}`)
    .join(';');
  return `${REQUEST_PREFIX}|${dataLength.toString(36)}|${symbolSize.toString(36)}|${body}`;
}

export function parseRaptorQRecoveryRequest(value: string): RaptorQRecoveryRequest {
  const parts = value.trim().toLowerCase().split('|');
  if (parts.length !== 4 || parts[0] !== REQUEST_PREFIX.toLowerCase()) {
    throw new Error('Invalid RaptorQ recovery request');
  }
  const dataLength = parseBase36(parts[1]!, 'data length');
  const symbolSize = parseBase36(parts[2]!, 'symbol size');
  const layout = sourceLayoutForRaptorQ(dataLength, symbolSize);
  const missingIds = new Set<string>();
  if (parts[3]) {
    for (const group of parts[3].split(';')) {
      const [blockText, ranges, extra] = group.split('=');
      if (extra !== undefined || !blockText || ranges === undefined) throw new Error('Invalid RaptorQ recovery ranges');
      const block = parseBase36(blockText, 'source block');
      for (const esi of parseRanges(ranges)) {
        validateSourceSymbol(layout, block, esi);
        missingIds.add(`${block}:${esi}`);
      }
    }
  }
  return { dataLength, symbolSize, missingIds };
}

export function selectRaptorQRecoveryPacketIndices(
  transportPackets: readonly Uint8Array[],
  requestText: string,
): number[] {
  const request = parseRaptorQRecoveryRequest(requestText);
  const indexes: number[] = [];
  transportPackets.forEach((transport, index) => {
    const packet = parsePacket(transport);
    if (packet.header.symbolIndex !== RAPTORQ_SYMBOL_INDEX) return;
    if (packet.header.dataLength !== request.dataLength) throw new Error('Recovery request data length does not match this transfer');
    if (packet.payload.length !== request.symbolSize) throw new Error('Recovery request symbol size does not match this transfer');
    if (request.missingIds.has(raptorQPayloadId(packet.payload))) indexes.push(index);
  });
  if (indexes.length !== request.missingIds.size) {
    throw new Error('Recovery request references missing source packets that are not present in this transfer');
  }
  return indexes;
}

function parsePayloadId(payload: Uint8Array): { sourceBlock: number; encodingSymbolId: number } {
  if (payload.length < PAYLOAD_ID_BYTES) throw new Error('RaptorQ payload is too short for a Payload ID');
  return {
    sourceBlock: payload[0]!,
    encodingSymbolId: ((payload[1]! << 16) | (payload[2]! << 8) | payload[3]!) >>> 0,
  };
}

function formatRanges(input: readonly number[]): string {
  const values = [...new Set(input)].sort((left, right) => left - right);
  if (values.length === 0) return '';
  const output: string[] = [];
  let start = values[0]!;
  let previous = start;
  for (let index = 1; index <= values.length; index++) {
    const current = values[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    const first = start.toString(36);
    const last = previous.toString(36);
    output.push(start === previous ? first : `${first}-${last}`);
    start = current!;
    previous = current!;
  }
  return output.join(',');
}

function parseRanges(value: string): number[] {
  if (!value) return [];
  const result: number[] = [];
  for (const part of value.split(',')) {
    const bounds = part.split('-');
    if (bounds.length > 2 || !bounds[0]) throw new Error('Invalid RaptorQ recovery range');
    const start = parseBase36(bounds[0], 'range');
    const end = bounds[1] === undefined ? start : parseBase36(bounds[1], 'range');
    if (end < start || end - start > 1_000_000) throw new Error('Invalid RaptorQ recovery range');
    for (let value = start; value <= end; value++) result.push(value);
  }
  return result;
}

function parseBase36(value: string, label: string): number {
  if (!/^[0-9a-z]+$/.test(value)) throw new Error(`Invalid RaptorQ recovery ${label}`);
  const parsed = Number.parseInt(value, 36);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid RaptorQ recovery ${label}`);
  return parsed;
}

function validateSourceSymbol(layout: RaptorQSourceLayout, sourceBlock: number, esi: number): void {
  const count = layout.blockSourceCounts[sourceBlock];
  if (count === undefined || esi >= count) {
    throw new Error(`RaptorQ recovery source symbol is outside this transfer: ${sourceBlock}:${esi}`);
  }
}
