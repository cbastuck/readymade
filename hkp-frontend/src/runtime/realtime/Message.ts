import {
  Data,
  DataTypeId,
  FloatRingBuffer,
  FloatRingBufferSymbol,
  getDataTypeId,
  isFloatRingBuffer,
  isNull,
  makeNull,
  makeText,
  TextData,
} from "./Data";

export enum MessagePurpose {
  NOTIFICATION = 0,
  RESULT = 1,
  RESULT_AWAITING_RESPONSE = 2,
  RESULT_WITH_REQUEST_ID = 3,
}

export type YASHeaderDetails = {
  version: number;
  type: number;
  endian: number;
  compact: number;
  reserved: number;
};

export type Message = {
  purpose: MessagePurpose;
  data: Data;
  sender: string;
};

export function serializeYasMessage(data: Data, sender: string): Blob {
  const header = new ArrayBuffer(
    7 + // YAS header
      2 + // Result Header Type
      2 + // Data Type ID
      8 + // Sender service id length
      sender.length
  );
  const view = new DataView(header);

  let offset = 0;
  offset += writeYasHeader(view);

  // Write the data purpose (2 bytes)
  view.setUint16(offset, MessagePurpose.NOTIFICATION, true); // Data Purpose
  offset += 2;

  // Write the Data Type ID (2 bytes)
  view.setUint16(offset, getDataTypeId(data), true); // Data Type ID
  offset += 2;

  // Write the sender service-id length (8 bytes)
  view.setBigUint64(offset, BigInt(sender.length), true); // Sender service id length
  offset += 8;

  // Write the sender service id
  for (let i = 0; i < sender.length; i++) {
    view.setUint8(offset + i, sender.charCodeAt(i));
  }
  offset += sender.length;

  // Serialize the data
  if (isFloatRingBuffer(data)) {
    return new Blob([header, serializeYasRingBuffer(data)]);
  }

  if (isNull(data)) {
    const payload: ArrayBuffer = new ArrayBuffer(1);
    const view = new Uint8Array(payload);
    view[0] = 0;
    return new Blob([header, payload]);
  }

  // If data is not a FloatRingBuffer, we throw an error
  throw new Error("serializeYasMessage: data is not a FloatRingBuffer");
}

export function deserializeYasMessage(buffer: ArrayBuffer): Message {
  const view = new DataView(buffer);

  let offset = 0;
  // Skip the 8-byte YAS header and version
  offset += parseYasHeader(view);

  const isLittleEndian = true; // optional: use from parsed yas headers

  // Read the data purpose (2 bytes)
  const purpose = view.getUint16(offset, isLittleEndian);
  offset += 2;

  const dataType = view.getUint16(offset, isLittleEndian);
  offset += 2;

  const senderLength = Number(view.getBigUint64(offset, isLittleEndian));
  offset += 8;
  const sender = new TextDecoder().decode(
    buffer.slice(offset, offset + senderLength)
  );
  offset += senderLength;

  if (dataType === DataTypeId.FloatRingBuffer) {
    return {
      purpose,
      data: deserializeYasRingBuffer(view, offset),
      sender,
    };
  } else if (dataType === DataTypeId.JSON) {
    return {
      purpose,
      data: deserializeYasJson(view, offset),
      sender,
    };
  } else if (dataType === DataTypeId.Null) {
    return {
      purpose,
      data: makeNull(),
      sender,
    };
  } else if (dataType === DataTypeId.String) {
    //const data = new TextDecoder().decode(buffer.slice(offset));
    //console.log("deserializeYasMessage: String data type", data);
    return {
      purpose,
      data: deserializeYasText(view, offset),
      sender,
    };
  }
  throw new Error(
    `deserializeYasMessage: unsupported type: ${dataType} ${buffer}`
  );
}

function deserializeYasText(view: DataView, offset: number): TextData {
  offset += parseYasHeader(view, offset);
  const isLittleEndian = true; // optional: read from yas header
  const textLength = Number(view.getBigUint64(offset, isLittleEndian));
  offset += 8;

  const textString = new TextDecoder().decode(
    view.buffer.slice(offset, offset + textLength)
  );
  return makeText(textString);
}

function deserializeYasJson(view: DataView, offset: number) {
  offset += parseYasHeader(view, offset);
  const isLittleEndian = true; // optional: read from yas header
  const jsonLength = Number(view.getBigUint64(offset, isLittleEndian));
  offset += 8;

  const jsonString = new TextDecoder().decode(
    view.buffer.slice(offset, offset + jsonLength)
  );
  return JSON.parse(jsonString);
}

function deserializeYasRingBuffer(
  view: DataView,
  offset: number
): FloatRingBuffer {
  // 1. Skip the YAS header
  offset += parseYasHeader(view, offset);
  const isLittleEndian = true; // optional from parsed header

  // 2. Read the type (uint16_t)
  const typeId = view.getUint16(offset, isLittleEndian);
  if (typeId !== DataTypeId.FloatRingBuffer) {
    throw new Error(`deserializeYasRingBuffer: incorrect type: ${typeId}`);
  }
  offset += 2;

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

function serializeYasRingBuffer(data: FloatRingBuffer): ArrayBuffer {
  const buffer = new ArrayBuffer(
    7 + // YAS header
      4 + // Type length
      8 + // Number of samples (unsigned long)
      data.array.length + // Array contents
      4 + // ID (uint32_t)
      8 // Timestamp (uint64_t)
  );
  const view = new DataView(buffer);

  let offset = 0;
  offset += writeYasHeader(view);

  // Write the type (uint32_t)
  view.setUint32(offset, DataTypeId.FloatRingBuffer, true); // Type id for FloatRingBuffer
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

function writeYasHeader(view: DataView, offset: number = 0): number {
  view.setUint8(offset, 121); // 'y' character
  view.setUint8(offset + 1, 97); // 'a' character
  view.setUint8(offset + 2, 115); // 's' character
  view.setUint8(offset + 3, 48); // ASCII '0' character
  view.setUint8(offset + 4, 48); // ASCII '0' character
  view.setUint8(offset + 5, 49); // ASCII for type '1' (binary)
  view.setUint8(offset + 6, 55); // ASCII for version '7'
  return 7;
}

/*
  YAS 7-byte header binary format:
  byte 1: 0x79 121 ('y')
  byte 2: 0x61 97 ('a')
  byte 3: 0x73 115 ('s')
  byte 4 version   -> 4 bits; // version      : 0...15
  byte 4 type      -> 3 bits  // archive type : 0...7: binary, text, json
  byte 4 endian    -> 1 bit   // endianness   : 0 - LE, 1 - BE
  byte 5 compacted -> 1 bit   // compacted    : 0 - no, 1 - yes
  byte 5 reserved  -> 7 bit   // reserved
  byte 6 reserved  -> 8 bit   // reserved
  byte 7 reserved  -> 8 bit   // reserved
*/
function parseYasHeader(
  view: DataView,
  offset: number = 0,
  details?: YASHeaderDetails
) {
  const byte1 = view.getUint8(offset);
  const byte2 = view.getUint8(offset + 1);
  const byte3 = view.getUint8(offset + 2);
  if (byte1 !== 121 || byte2 !== 97 || byte3 !== 115) {
    throw new Error("Invalid YAS buffer header");
  }

  if (details) {
    // -48 because the values are stored as hex ascii characters
    const byte5 = view.getUint8(offset + 4) - 48;
    const byte6 = view.getUint8(offset + 5) - 48;
    const byte7 = view.getUint8(offset + 6) - 48;
    details.compact = byte5 & 0b10000000;
    details.reserved = byte5 & 0b01111111;
    details.endian = byte6 & 0b00001000;
    details.type = byte6 & 0b00000111;
    details.version = byte7;
  }

  return 7;
}
