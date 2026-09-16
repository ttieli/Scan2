import { describe, expect, it } from 'vitest';
import { createPacket, type PacketHeader } from '../protocol/packet';
import {
  buildRaptorQRecoveryRequest,
  createRaptorQSourceProgress,
  parseRaptorQRecoveryRequest,
  raptorQPayloadId,
  selectRaptorQRecoveryPacketIndices,
  sourceLayoutForRaptorQ,
} from '../fec/raptorq_recovery';

const DATA_LENGTH = 25;
const SYMBOL_SIZE = 12; // 4-byte Payload ID + 8 source bytes => four source symbols.

function payload(sourceBlock: number, esi: number): Uint8Array {
  const value = new Uint8Array(SYMBOL_SIZE);
  value[0] = sourceBlock;
  value[1] = (esi >>> 16) & 0xff;
  value[2] = (esi >>> 8) & 0xff;
  value[3] = esi & 0xff;
  value.fill(0x5a, 4);
  return value;
}

function transport(sourceBlock: number, esi: number): Uint8Array {
  const header: PacketHeader = {
    generationIndex: 0,
    totalGenerations: 6,
    symbolIndex: 31,
    isText: false,
    isLastGeneration: false,
    compressed: false,
    dataLength: DATA_LENGTH,
  };
  return createPacket(header, payload(sourceBlock, esi));
}

describe('RaptorQ recovery requests', () => {
  it('derives source block geometry and stable payload IDs', () => {
    const layout = sourceLayoutForRaptorQ(DATA_LENGTH, SYMBOL_SIZE);
    expect(layout.totalSourceSymbols).toBe(4);
    expect(layout.blockSourceCounts).toEqual([4]);
    expect(raptorQPayloadId(payload(0, 3))).toBe('0:3');
  });

  it('builds compact missing ranges and parses them without loss', () => {
    const request = buildRaptorQRecoveryRequest(DATA_LENGTH, SYMBOL_SIZE, [
      '0:1', '0:2', '0:3',
    ]);
    expect(request).toBe('RQ1|p|c|0=1-3');
    const parsed = parseRaptorQRecoveryRequest(request);
    expect(parsed.dataLength).toBe(DATA_LENGTH);
    expect(parsed.symbolSize).toBe(SYMBOL_SIZE);
    expect([...parsed.missingIds]).toEqual(['0:1', '0:2', '0:3']);
  });

  it('creates bounded progress buckets and the exact missing source set', () => {
    const progress = createRaptorQSourceProgress(new Set(['0:0', '0:2', '0:4']), DATA_LENGTH, SYMBOL_SIZE, 3);
    expect(progress.sourceTotal).toBe(4);
    expect(progress.sourceReceived).toBe(2);
    expect(progress.missingSourceIds).toEqual(['0:1', '0:3']);
    expect(progress.buckets).toHaveLength(3);
    expect(progress.buckets.reduce((sum, bucket) => sum + bucket.received, 0)).toBe(2);
  });

  it('selects only requested canonical transport packets', () => {
    const packets = [transport(0, 0), transport(0, 1), transport(0, 2), transport(0, 3), transport(0, 4)];
    const request = buildRaptorQRecoveryRequest(DATA_LENGTH, SYMBOL_SIZE, ['0:1', '0:3']);
    expect(selectRaptorQRecoveryPacketIndices(packets, request)).toEqual([1, 3]);
  });

  it('rejects malformed and mismatched requests', () => {
    expect(() => parseRaptorQRecoveryRequest('RQ1|bad')).toThrow();
    const packets = [transport(0, 0)];
    const wrongLength = buildRaptorQRecoveryRequest(DATA_LENGTH + 1, SYMBOL_SIZE, ['0:0']);
    expect(() => selectRaptorQRecoveryPacketIndices(packets, wrongLength)).toThrow('data length');
    const wrongSize = buildRaptorQRecoveryRequest(DATA_LENGTH, SYMBOL_SIZE + 1, ['0:0']);
    expect(() => selectRaptorQRecoveryPacketIndices(packets, wrongSize)).toThrow('symbol size');
    const incompletePacketSet = buildRaptorQRecoveryRequest(DATA_LENGTH, SYMBOL_SIZE, ['0:0', '0:1']);
    expect(() => selectRaptorQRecoveryPacketIndices(packets, incompletePacketSet)).toThrow('missing source packets');
    expect(() => buildRaptorQRecoveryRequest(DATA_LENGTH, SYMBOL_SIZE, ['0:4'])).toThrow('source symbol');
    expect(() => parseRaptorQRecoveryRequest('RQ1|p|c|1=0')).toThrow('source symbol');
  });
});
