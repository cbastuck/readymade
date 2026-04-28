/**
 * Service Documentation
 * Service ID: hookup.to/service/encode
 * Service Name: Encode
 * Modes: base64-encode | base64-decode | url-encode | url-decode | hex-encode | hex-decode
 * Key Config: mode (default: "base64-encode")
 * IO: in=string|any -> out=string|any
 *
 * base64-encode: UTF-8-safe base64. Non-string inputs are JSON-stringified first.
 * base64-decode: Decodes a base64 string; if the result is valid JSON it is parsed.
 * url-encode:    Applies encodeURIComponent. Non-strings are JSON-stringified first.
 * url-decode:    Applies decodeURIComponent; tries JSON.parse on the result.
 * hex-encode:    Encodes to hex (lowercase). Non-strings are JSON-stringified first.
 * hex-decode:    Decodes a hex string back to UTF-8; tries JSON.parse on the result.
 */

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import EncodeUI from "./EncodeUI";
import { EncodeMode } from "./encode-modes";

const serviceId = "hookup.to/service/encode";
const serviceName = "Encode";

type State = { mode: EncodeMode };

function toUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function fromUtf8Base64(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function serialize(input: any): string {
  return typeof input === "string" ? input : JSON.stringify(input);
}

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

class Encode extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { mode: "base64-encode" });
  }

  configure(config: Partial<State>) {
    if (config.mode !== undefined) {
      this.state.mode = config.mode;
      this.app.notify(this, { mode: config.mode });
    }
  }

  process(input: any): any {
    switch (this.state.mode) {
      case "base64-encode":
        return toUtf8Base64(serialize(input));

      case "base64-decode": {
        try {
          return tryParseJson(fromUtf8Base64(serialize(input)));
        } catch {
          this.pushErrorNotification("Encode: invalid base64 input");
          return null;
        }
      }

      case "url-encode":
        return encodeURIComponent(serialize(input));

      case "url-decode": {
        try {
          return tryParseJson(decodeURIComponent(serialize(input)));
        } catch {
          this.pushErrorNotification("Encode: invalid URL-encoded input");
          return null;
        }
      }

      case "hex-encode":
        return toHex(serialize(input));

      case "hex-decode": {
        try {
          return tryParseJson(fromHex(serialize(input)));
        } catch {
          this.pushErrorNotification("Encode: invalid hex input");
          return null;
        }
      }
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Encode(app, board, descriptor, id),
  createUI: EncodeUI,
};

export default descriptor;
