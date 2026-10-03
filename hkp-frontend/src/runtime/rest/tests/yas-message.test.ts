import { describe, expect, it } from "vitest";

import { DataTypeId, makeNull, passesNothing } from "../Data";
import {
  MessagePurpose,
  deserializeYasMessage,
  serializeYasMessage,
} from "../Message";

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

// jsdom's Blob has no arrayBuffer().
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("serializeYasMessage", () => {
  it("writes binary data the way the runtimes frame it", async () => {
    // What a runtime's result is forwarded as when it is bytes: framed exactly
    // as hkp-rt writes one, so every runtime reads it the same way.
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
    const blob = serializeYasMessage(bytes, "", MessagePurpose.RESULT);
    const written = new Uint8Array(await readBlob(blob));

    expect(written).toEqual(
      new Uint8Array(frame(DataTypeId.BinaryData, "", bytes)),
    );
    expect(deserializeYasMessage(written.buffer).data).toEqual(bytes);
  });

  it("writes a view by its own bytes, not its whole buffer", async () => {
    const backing = new Uint8Array([9, 9, 1, 2, 3, 9]);
    const view = backing.subarray(2, 5);
    const blob = serializeYasMessage(view, "", MessagePurpose.RESULT);
    const message = deserializeYasMessage(await readBlob(blob));

    expect(message.data).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("passesNothing", () => {
  it("is true for null and for a Null a remote runtime sends", () => {
    expect(passesNothing(null)).toBe(true);
    // What a runtime's Null result decodes to.
    const nothing = deserializeYasMessage(
      frame(DataTypeId.Null, "", new Uint8Array([0])),
    ).data;
    expect(passesNothing(nothing)).toBe(true);
    expect(passesNothing(makeNull())).toBe(true);
  });

  it("is false for anything else, empty or falsy included", () => {
    for (const result of [undefined, 0, "", false, {}, [], new Uint8Array()]) {
      expect(passesNothing(result)).toBe(false);
    }
  });
});
