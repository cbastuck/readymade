import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import SignUI from "./SignUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/sign
 * Service Name: Sign
 * Input:  any — stringified before signing
 * Output: hex or base64 HMAC string
 * Config: method ("HmacSHA256" | "HmacSHA512" | "HmacSHA1" | "HmacSHA256p"),
 *         encoding ("hex" | "base64"), secret (string)
 *
 * HmacSHA256p is a progressive mode: chunks are buffered and the HMAC over all
 * buffered data is produced when configure({ finalize: true }) is called.
 */

const serviceId = "hookup.to/service/sign";
const serviceName = "Sign";

const METHODS = ["HmacSHA256", "HmacSHA256p", "HmacSHA512", "HmacSHA1"] as const;
type Method = (typeof METHODS)[number];
const ENCODINGS = ["hex", "base64"] as const;
type Encoding = (typeof ENCODINGS)[number];

type State = {
  methods: readonly string[];
  method: Method;
  encodings: readonly string[];
  encoding: Encoding;
  secret: string;
};

const HASH_FOR_HMAC: Partial<Record<Method, string>> = {
  HmacSHA256:  "SHA-256",
  HmacSHA256p: "SHA-256",
  HmacSHA512:  "SHA-512",
  HmacSHA1:    "SHA-1",
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function encode(buffer: ArrayBuffer, encoding: Encoding): string {
  return encoding === "base64" ? toBase64(buffer) : toHex(buffer);
}

async function hmac(hash: string, secret: string, data: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, data);
}

class Sign extends ServiceBase<State> {
  private _progressiveChunks: Uint8Array[] = [];

  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      methods: METHODS,
      method: "HmacSHA256",
      encodings: ENCODINGS,
      encoding: "hex",
      secret: "secret key 123",
    });
  }

  configure(config: any) {
    if (config.method !== undefined) {
      this.state.method = config.method;
      this._progressiveChunks = [];
      this.app.notify(this, { method: config.method });
    }
    if (config.encoding !== undefined) {
      this.state.encoding = config.encoding;
      this.app.notify(this, { encoding: config.encoding });
    }
    if (config.secret !== undefined) {
      this.state.secret = config.secret;
      this.app.notify(this, { secret: config.secret });
    }
    if (config.finalize === true && this.state.method === "HmacSHA256p") {
      this.finalizeProgressive();
    }
  }

  async process(params: any): Promise<string | null> {
    const hash = HASH_FOR_HMAC[this.state.method];
    if (!hash) {
      console.warn("Sign: unknown method", this.state.method);
      return null;
    }

    const data = this.toBytes(params);

    if (this.state.method === "HmacSHA256p") {
      this._progressiveChunks.push(data);
      return null; // accumulates until finalize
    }

    const sig = await hmac(hash, this.state.secret, data);
    return encode(sig, this.state.encoding);
  }

  private async finalizeProgressive() {
    if (this._progressiveChunks.length === 0) { return; }
    const totalLength = this._progressiveChunks.reduce((n, c) => n + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this._progressiveChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    this._progressiveChunks = [];
    const sig = await hmac("SHA-256", this.state.secret, combined);
    this.app.next(this, encode(sig, this.state.encoding));
  }

  private toBytes(params: any): Uint8Array {
    const msg = typeof params === "string" ? params : JSON.stringify(params);
    return new TextEncoder().encode(msg);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Sign(app, board, descriptor, id),
  createUI: SignUI,
};

export default descriptor;
