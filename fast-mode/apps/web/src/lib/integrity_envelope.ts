const MAGIC = new Uint8Array([0x51, 0x52, 0x46, 0x33]); // QRF3
const VERSION = 1;
const FIXED_HEADER_BYTES = 46;
const textEncoder = new TextEncoder();
const fatalTextDecoder = new TextDecoder('utf-8', { fatal: true });

export interface VerifiedIntegrityEnvelope {
  data: Uint8Array;
  isText: boolean;
  filename: string;
  mime: string;
  sha256: string;
}

export async function wrapIntegrityEnvelope(
  data: Uint8Array,
  isText: boolean,
  filename = '',
  mime = '',
): Promise<Uint8Array> {
  const normalized = new Uint8Array(data);
  const filenameBytes = isText ? new Uint8Array(0) : textEncoder.encode(filename);
  const mimeBytes = isText ? new Uint8Array(0) : textEncoder.encode(mime || 'application/octet-stream');
  if (filenameBytes.length > 0xffff || mimeBytes.length > 0xffff) {
    throw new RangeError('Integrity envelope metadata is too large');
  }
  if (normalized.length > 0xffffffff) throw new RangeError('Integrity envelope data is too large');

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', normalized));
  const result = new Uint8Array(FIXED_HEADER_BYTES + filenameBytes.length + mimeBytes.length + normalized.length);
  result.set(MAGIC, 0);
  result[4] = VERSION;
  result[5] = isText ? 1 : 0;
  const view = new DataView(result.buffer);
  view.setUint32(6, normalized.length, false);
  result.set(digest, 10);
  view.setUint16(42, filenameBytes.length, false);
  view.setUint16(44, mimeBytes.length, false);
  let offset = FIXED_HEADER_BYTES;
  result.set(filenameBytes, offset);
  offset += filenameBytes.length;
  result.set(mimeBytes, offset);
  offset += mimeBytes.length;
  result.set(normalized, offset);
  return result;
}

export async function unwrapAndVerifyIntegrityEnvelope(
  input: Uint8Array,
): Promise<VerifiedIntegrityEnvelope> {
  const bytes = new Uint8Array(input);
  if (bytes.length < FIXED_HEADER_BYTES) throw new Error('Integrity envelope truncated');
  if (!MAGIC.every((value, index) => bytes[index] === value) || bytes[4] !== VERSION) {
    throw new Error('Integrity envelope format mismatch');
  }
  if (bytes[5] !== 0 && bytes[5] !== 1) throw new Error('Integrity envelope kind mismatch');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataLength = view.getUint32(6, false);
  const filenameLength = view.getUint16(42, false);
  const mimeLength = view.getUint16(44, false);
  const dataOffset = FIXED_HEADER_BYTES + filenameLength + mimeLength;
  if (dataOffset > bytes.length || bytes.length - dataOffset !== dataLength) {
    throw new Error('Integrity envelope length mismatch');
  }
  const isText = bytes[5] === 1;
  if (isText && (filenameLength !== 0 || mimeLength !== 0)) {
    throw new Error('Integrity envelope text metadata mismatch');
  }
  const filename = fatalTextDecoder.decode(bytes.slice(FIXED_HEADER_BYTES, FIXED_HEADER_BYTES + filenameLength));
  const mime = fatalTextDecoder.decode(bytes.slice(FIXED_HEADER_BYTES + filenameLength, dataOffset));
  const data = bytes.slice(dataOffset);
  const expectedDigest = bytes.slice(10, 42);
  const actualDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  if (!constantTimeEqual(expectedDigest, actualDigest)) throw new Error('SHA-256 mismatch');
  return {
    data,
    isText,
    filename,
    mime: isText ? 'text/plain;charset=utf-8' : (mime || 'application/octet-stream'),
    sha256: toHex(actualDigest),
  };
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}
