import { describe, expect, it } from "vitest";

import { DataTypeId } from "../Data";
import { MessagePurpose, deserializeYasMessage } from "../Message";

// A frame laid out the way hkp-rt's Message::serialize writes one: YAS header,
// purpose, data type, sender, then the payload.
function frame(dataType: number, sender: string, payload: Uint8Array): ArrayBuffer {
  const head = 7 + 2 + 2 + 8 + sender.length;
  const buffer = new ArrayBuffer(head + payload.length);
  const view = new DataView(buffer);
  [121, 97, 115, 48, 48, 49, 55].forEach((byte, i) => view.setUint8(i, byte));
  view.setUint16(7, MessagePurpose.RESULT, true);
  view.setUint16(9, dataType, true);
  view.setBigUint64(11, BigInt(sender.length), true);
  new Uint8Array(buffer, 19, sender.length).set(new TextEncoder().encode(sender));
  new Uint8Array(buffer, head).set(payload);
  return buffer;
}

describe("deserializeYasMessage", () => {
  it("reads binary data as the bytes after the header", () => {
    // A result a runtime ends on when its last service emits bytes, e.g. an
    // encoder's output.
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
    const message = deserializeYasMessage(frame(DataTypeId.BinaryData, "RUNTIME", bytes));

    expect(message.purpose).toBe(MessagePurpose.RESULT);
    expect(message.sender).toBe("RUNTIME");
    expect(message.data).toEqual(bytes);
  });

  it("still refuses a type it cannot read", () => {
    expect(() =>
      deserializeYasMessage(frame(DataTypeId.CustomData, "x", new Uint8Array([0]))),
    ).toThrow(/unsupported type/);
  });
});
