// Note this enum in in sync with hkp-rt/lib/include/types/data.h
export enum DataTypeId {
  Undefined = 0,
  FloatRingBuffer = 1,
  JSON = 2,
  BinaryData = 3,
  String = 4,
  Null = 5,
  ControlFlowData = 6,
  CustomData = 7,
}

export function getDataTypeId(data: Data): DataTypeId {
  if (isFloatRingBuffer(data)) {
    return DataTypeId.FloatRingBuffer;
  } else if (isNull(data)) {
    return DataTypeId.Null;
  } else if (isBinaryData(data)) {
    return DataTypeId.BinaryData;
  }
  // Add other data types as needed
  throw new Error("Unsupported data type");
}

export const FloatRingBufferSymbol = Symbol("FloatRingBuffer");
export const NullSymbol = Symbol("Null");
export const TextSymbol = Symbol("Text");

export type FloatRingBuffer = {
  type: typeof FloatRingBufferSymbol;
  array: Uint8Array;
  id: number; // identifier for the rng buffer
  ts: number; // timestamp
};

export type TextData = {
  type: typeof TextSymbol;
  text: string;
};

export function makeText(text: string): TextData {
  return { type: TextSymbol, text };
}

export type Null = {
  type: typeof NullSymbol;
};

export function makeNull(): Null {
  return { type: NullSymbol };
}

// Raw bytes, as hkp-rt sends BinaryData: the payload is the bytes themselves.
export type BinaryData = Uint8Array;

export type Data = FloatRingBuffer | Null | TextData | BinaryData;

export function isFloatRingBuffer(data: any): data is FloatRingBuffer {
  return data?.type === FloatRingBufferSymbol;
}

export function isNull(data: any): data is Null {
  return data?.type === NullSymbol;
}

/**
 * Whether a result says "nothing to pass on": `null` from a browser runtime, a
 * Null from a remote one. Either stops the chain before the next runtime.
 */
export function passesNothing(result: unknown): boolean {
  return result === null || isNull(result);
}

export function isBinaryData(data: any): data is BinaryData {
  return data instanceof Uint8Array;
}

export function isData(data: any): data is Data {
  return isFloatRingBuffer(data) || isNull(data);
}

export function convertToUint8Array(floatArray: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(floatArray.length * 4);
  const dataView = new DataView(buffer);

  for (let i = 0; i < floatArray.length; i++) {
    dataView.setFloat32(i * 4, floatArray[i], true); // true for little-endian
  }

  return new Uint8Array(buffer);
}

export function convertToFloat32Array(array: Uint8Array): Float32Array {
  const buffer = array.buffer;
  const byteOffset = array.byteOffset;
  const length = array.length / 4; // Number of 32-bit floats

  const dataView = new DataView(buffer, byteOffset);
  const floatArray = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    floatArray[i] = dataView.getFloat32(i * 4, true); // true for little-endian
  }

  return floatArray;
}
