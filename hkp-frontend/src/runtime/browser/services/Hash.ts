import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import HashUI from "./HashUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/hash
 * Service Name: Hash
 * Input:  any — stringified before hashing (Uint8Array/ArrayBuffer hashed directly)
 * Output: hex or base64 string
 * Config: method ("sha-256" | "sha-384" | "sha-512" | "sha-1" | "sha-256p"),
 *         encoding ("hex" | "base64")
 *
 * sha-256p is a progressive mode: chunks are buffered and the final hash is
 * produced when configure({ finalize: true }) is called, emitting the result
 * via app.next.
 */

const serviceId = "hookup.to/service/hash";
const serviceName = "Hash";

const METHODS = ["sha-256", "sha-256p", "sha-1", "sha-384", "sha-512"] as const;
type Method = (typeof METHODS)[number];
const ENCODINGS = ["hex", "base64"] as const;
type Encoding = (typeof ENCODINGS)[number];

type State = {
  methods: readonly string[];
  method: Method;
  encodings: readonly string[];
  encoding: Encoding;
};

// SubtleCrypto algorithm name for each method
const ALGO: Partial<Record<Method, string>> = {
  "sha-256":  "SHA-256",
  "sha-256p": "SHA-256",
  "sha-1":    "SHA-1",
  "sha-384":  "SHA-384",
  "sha-512":  "SHA-512",
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

class Hash extends ServiceBase<State> {
  private _progressiveChunks: Uint8Array[] = [];

  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      methods: METHODS,
      method: "sha-256",
      encodings: ENCODINGS,
      encoding: "hex",
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
    if (config.finalize === true && this.state.method === "sha-256p") {
      this.finalizeProgressive();
    }
  }

  async process(params: any): Promise<string | null> {
    const algo = ALGO[this.state.method];
    if (!algo) {
      console.warn("Hash: unknown method", this.state.method);
      return null;
    }

    const data = this.toBytes(params);

    if (this.state.method === "sha-256p") {
      this._progressiveChunks.push(data);
      return null; // accumulates until finalize
    }

    const digest = await crypto.subtle.digest(algo, data);
    return encode(digest, this.state.encoding);
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
    const digest = await crypto.subtle.digest("SHA-256", combined);
    this.app.next(this, encode(digest, this.state.encoding));
  }

  private toBytes(params: any): Uint8Array {
    if (params instanceof Uint8Array) { return params; }
    if (params instanceof ArrayBuffer) { return new Uint8Array(params); }
    const msg = typeof params === "string" ? params : JSON.stringify(params);
    return new TextEncoder().encode(msg);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Hash(app, board, descriptor, id),
  createUI: HashUI,
};

export default descriptor;
