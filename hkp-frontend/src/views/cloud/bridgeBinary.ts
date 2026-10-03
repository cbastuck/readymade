import {
  FloatRingBufferSymbol,
  isFloatRingBuffer,
} from "../../runtime/rest/Data";

/**
 * How a value that is not JSON crosses the coordinator bridge.
 *
 * The bridge carries JSON as text frames. A value holding bytes travels as one
 * binary frame instead:
 *
 *   [ 4 bytes: header length, big-endian ][ header: UTF-8 JSON ][ payload ]
 *
 * The header is the message that would have been sent as text, with the value
 * left out and a `binary` field in its place saying what the payload is:
 *
 *   bytes            the payload is the value
 *   floatRingBuffer  little-endian float32 samples; `id` and `ts` in the header
 *   mixed            an object with bytes in its `binary` field; the header
 *                    carries the rest of the object, the payload those bytes
 *
 * Mirrors hkp-node/src/coordinator/binaryFrame.ts, which is the coordinator's
 * end of the same frame; the two must agree.
 */

export type BinaryShape =
  | { kind: "bytes" }
  | { kind: "floatRingBuffer"; id: number; ts: number }
  | { kind: "mixed"; json: Record<string, unknown> };

export type BinaryValue = { shape: BinaryShape; bytes: Uint8Array };

const LENGTH_BYTES = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * What a pipeline value travels as, or null when it is JSON and travels as
 * text.
 */
export function toBinaryValue(value: unknown): BinaryValue | null {
  if (isFloatRingBuffer(value)) {
    return {
      shape: { kind: "floatRingBuffer", id: value.id, ts: value.ts },
      bytes: value.array,
    };
  }
  if (value instanceof Uint8Array) {
    return { shape: { kind: "bytes" }, bytes: value };
  }
  if (value instanceof ArrayBuffer) {
    return { shape: { kind: "bytes" }, bytes: new Uint8Array(value) };
  }
  if (isRecord(value) && value.binary instanceof Uint8Array) {
    const { binary, ...json } = value;
    return { shape: { kind: "mixed", json }, bytes: binary };
  }
  return null;
}

/** The pipeline value a payload stands for; see `toBinaryValue`. */
export function fromBinaryValue({ shape, bytes }: BinaryValue): unknown {
  switch (shape.kind) {
    case "bytes":
      return bytes;
    case "floatRingBuffer":
      return {
        type: FloatRingBufferSymbol,
        array: bytes,
        id: shape.id,
        ts: shape.ts,
      };
    case "mixed":
      return { ...shape.json, binary: bytes };
  }
}

export function encodeBinaryFrame(
  header: Record<string, unknown>,
  value: BinaryValue,
): Uint8Array {
  const head = new TextEncoder().encode(
    JSON.stringify({ ...header, binary: value.shape }),
  );
  const frame = new Uint8Array(LENGTH_BYTES + head.length + value.bytes.length);
  new DataView(frame.buffer).setUint32(0, head.length, false);
  frame.set(head, LENGTH_BYTES);
  frame.set(value.bytes, LENGTH_BYTES + head.length);
  return frame;
}

function readShape(value: unknown): BinaryShape | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.kind === "bytes") {
    return { kind: "bytes" };
  }
  if (value.kind === "floatRingBuffer") {
    return {
      kind: "floatRingBuffer",
      id: typeof value.id === "number" ? value.id : 0,
      ts: typeof value.ts === "number" ? value.ts : 0,
    };
  }
  if (value.kind === "mixed") {
    return { kind: "mixed", json: isRecord(value.json) ? value.json : {} };
  }
  return null;
}

/** Null for a frame that is not one of these. */
export function decodeBinaryFrame(
  raw: ArrayBuffer,
): { header: Record<string, unknown>; value: BinaryValue } | null {
  if (raw.byteLength < LENGTH_BYTES) {
    return null;
  }
  const headLength = new DataView(raw).getUint32(0, false);
  const end = LENGTH_BYTES + headLength;
  if (raw.byteLength < end) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(new Uint8Array(raw, LENGTH_BYTES, headLength)),
    );
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const { binary, ...header } = parsed;
  const shape = readShape(binary);
  if (!shape) {
    return null;
  }
  // A copy with its own backing store, so a service's bytes start at offset 0
  // and do not keep the whole frame alive.
  return { header, value: { shape, bytes: new Uint8Array(raw.slice(end)) } };
}
