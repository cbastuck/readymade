import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import DecryptUI from "./DecryptUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/decrypt
 * Service Name: Decrypt
 * Input:  base64 string — [12-byte IV][AES-256-GCM ciphertext] (produced by Encrypt)
 * Output: original value — JSON-deserialised object/string/number, or Blob
 * Config: secret (string), method ("aes")
 */

const serviceId = "hookup.to/service/decrypt";
const serviceName = "Decrypt";

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

async function base64ToBlob(base64: string): Promise<Blob> {
  const dataUrl = "data:application/octet-stream;base64," + base64;
  const resp = await fetch(dataUrl);
  return resp.blob();
}

class Decrypt extends ServiceBase<State> {
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

  async process(params: any): Promise<any> {
    if (!this.state.secret) {
      this.pushErrorNotification("Decrypt: no secret configured");
      return null;
    }

    if (typeof params !== "string") {
      this.pushErrorNotification("Decrypt: expected a base64-encoded string");
      return null;
    }

    try {
      const combined = Uint8Array.from(atob(params), (c) => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const key = await deriveKey(this.state.secret, "decrypt");
      const plaintextBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      );

      const plaintext = new TextDecoder().decode(plaintextBytes);
      const parsed = JSON.parse(plaintext);

      // Reconstruct Blob if the original input was one
      if (parsed && typeof parsed === "object" && "__blob" in parsed) {
        return base64ToBlob(parsed.__blob);
      }

      return parsed;
    } catch {
      this.pushErrorNotification("Decrypt: decryption failed — wrong key?");
      return null;
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Decrypt(app, board, descriptor, id),
  createUI: DecryptUI,
};

export default descriptor;
