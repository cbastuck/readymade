export const FloatRingBufferSymbol = Symbol("FloatRingBuffer");

export type FloatRingBuffer = {
  type: typeof FloatRingBufferSymbol;
  array: Uint8Array;
  id: number;
  ts: number;
};

export type Data = FloatRingBuffer;

export function isFloatRingBuffer(data: any): data is FloatRingBuffer {
  return data.type === FloatRingBufferSymbol;
}

export function isData(data: any): data is Data {
  return isFloatRingBuffer(data);
}

export async function deserializeYASBuffer(event: MessageEvent): Promise<Data> {
  const buffer = await event.data.arrayBuffer();
  const view = new DataView(buffer);

  let offset = 0;
  // Skip the 8-byte YAS header and version
  const header = new TextDecoder().decode(buffer.slice(0, 7));
  if (!header.startsWith("yas")) {
    throw new Error("Invalid YAS buffer");
  }
  offset += 7;

  // Read the endian type (1 byte)
  const endianTag = view.getUint8(offset);
  offset += 1;
  const isLittleEndian = endianTag === 0;

  // Read the Type length (uint32_t)
  const type = view.getUint32(offset, isLittleEndian);
  offset += 4;

  if (type === 1) {
    return deserializeRingBufferYAS(view, offset, isLittleEndian);
  }
  throw new Error(`Unsupported type: ${type}`);
}

function deserializeRingBufferYAS(
  view: DataView,
  offset: number,
  isLittleEndian: boolean
): FloatRingBuffer {
  // 3. Read the number of samples (unsigned long, 8 bytes)
  const numSamples = Number(view.getBigUint64(offset, isLittleEndian));
  const arrayLength = numSamples * 4; // Assuming each sample is 4 bytes (float)
  offset += 8;

  // 4. Read the array contents
  const array = new Uint8Array(view.buffer.slice(offset, offset + arrayLength));
  offset += arrayLength;

  // 5. Read the ID (uint32_t or int32_t)
  const id = view.getUint32(offset, isLittleEndian);
  offset += 4;

  // 6. Read timestamp as 64-bit integer
  const ts = Number(view.getBigUint64(offset, isLittleEndian));
  offset += 8;

  return {
    type: FloatRingBufferSymbol,
    array,
    id,
    ts,
  };
}

export function serializeRingBufferYAS(data: FloatRingBuffer): ArrayBuffer {
  const buffer = new ArrayBuffer(
    7 + // YAS header
      1 + // Endian type
      4 + // Type length
      8 + // Number of samples (unsigned long)
      data.array.length + // Array contents
      4 + // ID (uint32_t)
      8 // Timestamp (uint64_t)
  );
  const view = new DataView(buffer);

  let offset = 0;
  // Write the YAS header (7 bytes)
  const header = new TextEncoder().encode("yas0017");
  for (let i = 0; i < header.length; i++) {
    view.setUint8(i, header[i]);
  }
  offset += header.length;

  // Write the endian type (1 byte)
  view.setUint8(offset, 0); // Endian type (0 for little-endian)
  offset += 1;

  // Write the type length (uint32_t)
  view.setUint32(offset, 1, true); // Type length (1 for FloatRingBuffer)
  offset += 4;

  // Write the number of samples (unsigned long, 8 bytes)
  view.setBigUint64(offset, BigInt(data.array.length / 4), true); // Number of samples
  offset += 8;

  // Copy the array contents
  const array = new Uint8Array(data.array);
  for (let i = 0; i < array.length; i++) {
    view.setUint8(offset + i, array[i]);
  }
  offset += array.length;

  // Write the ID (uint32_t)
  view.setUint32(offset, data.id, true);
  offset += 4;

  // Write the timestamp (uint64_t)
  view.setBigUint64(offset, BigInt(data.id), true);
  offset += 8;

  return buffer;
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

export function convertToUint8Array(floatArray: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(floatArray.length * 4);
  const dataView = new DataView(buffer);

  for (let i = 0; i < floatArray.length; i++) {
    dataView.setFloat32(i * 4, floatArray[i], true); // true for little-endian
  }

  return new Uint8Array(buffer);
}
