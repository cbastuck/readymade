import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import EncryptUI from "./EncryptUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/encrypt
 * Service Name: Encrypt
 * Input:  any — JSON-serialisable value or Blob/File
 * Output: base64 string — [12-byte IV][AES-256-GCM ciphertext]
 * Config: secret (string), method ("aes" — only option for now)
 *
 * Key derivation: SHA-256 of the UTF-8 encoded secret → 256-bit AES-GCM key.
 * A fresh 12-byte random IV is generated per encrypt call and prepended to
 * the ciphertext. Blob/File inputs are base64-encoded before encryption so
 * the decrypt service can reconstruct them.
 */

const serviceId = "hookup.to/service/encrypt";
const serviceName = "Encrypt";

const METHODS = ["aes"] as const;
type Method = (typeof METHODS)[number];

type State = {
  secret: string;
  method: Method;
  methods: readonly string[];
};

async function deriveKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [usage]);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      resolve(url.split(";base64,")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

class Encrypt extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      secret: "",
      method: "aes",
      methods: METHODS,
    });
  }

  configure(config: any) {
    if (config.secret !== undefined) {
      this.state.secret = config.secret;
      this.app.notify(this, { secret: config.secret });
    }
    if (config.method !== undefined) {
      this.state.method = config.method;
      this.app.notify(this, { method: config.method });
    }
  }

  async process(params: any): Promise<string | null> {
    if (!this.state.secret) {
      this.pushErrorNotification("Encrypt: no secret configured");
      return null;
    }

    const isBlob = params instanceof Blob || params instanceof File;
    const plaintext = isBlob
      ? JSON.stringify({ __blob: await blobToBase64(params) })
      : JSON.stringify(params);

    const key = await deriveKey(this.state.secret, "encrypt");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Encrypt(app, board, descriptor, id),
  createUI: EncryptUI,
};

export default descriptor;
