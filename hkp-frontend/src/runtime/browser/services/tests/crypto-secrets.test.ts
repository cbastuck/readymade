import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SecretStore,
  THIS_DEVICE,
  setSecretStore,
} from "hkp-frontend/src/core/secrets";

import encrypt from "../Encrypt";
import decrypt from "../Decrypt";
import sign from "../Sign";

/**
 * The services whose credential never leaves this process.
 *
 * Their passphrase used to be ordinary state, which meant a saved board carried
 * it: open a board, save it, share it, and the key travels with it. What is
 * pinned here is that a reference stays a reference — what the service reports
 * is what it was configured with — while the value exists only inside the call
 * that derives a key from it.
 */

function storeOf(
  entries: Record<string, { value: string; audience?: string[] }>,
): SecretStore {
  return {
    get: (alias) => entries[alias]?.value ?? null,
    audience: (alias) => entries[alias]?.audience ?? null,
    list: () => Object.keys(entries),
  };
}

/** Enough of an AppInstance for these three, recording what they report. */
function testApp() {
  const notifications: any[] = [];
  const emitted: any[] = [];
  return {
    notifications,
    emitted,
    app: {
      notify: () => {},
      next: (_svc: unknown, value: unknown) => emitted.push(value),
      sendAction: (action: any) => notifications.push(action.payload),
    } as any,
  };
}

const make = (descriptor: any, app: any, state: Record<string, unknown> = {}) => {
  const service = descriptor.create(app, "Board", {} as any, "svc-1");
  service.configure(state);
  return service;
};

afterEach(() => setSecretStore(null));

describe("what a saved board carries", () => {
  it.each([
    ["Encrypt", encrypt],
    ["Decrypt", decrypt],
    ["Sign", sign],
  ])("%s reports the reference it was configured with", async (_name, descriptor) => {
    setSecretStore(storeOf({ pass: { value: "hunter2" } }));
    const { app } = testApp();
    const service = make(descriptor, app, { secret: "{{secret.pass}}" });

    const config: any = await service.getConfiguration();
    expect(config.secret).toBe("{{secret.pass}}");
    // The value the reference stands for appears nowhere in what is saved.
    expect(JSON.stringify(config)).not.toContain("hunter2");
  });
});

describe("Encrypt and Decrypt", () => {
  it("round-trip a value through a secret held only by the store", async () => {
    setSecretStore(storeOf({ pass: { value: "hunter2" } }));
    const { app } = testApp();
    const encrypter = make(encrypt, app, { secret: "{{secret.pass}}" });
    const decrypter = make(decrypt, app, { secret: "{{secret.pass}}" });

    const ciphertext = await encrypter.process({ hello: "world" });
    expect(typeof ciphertext).toBe("string");
    expect(await decrypter.process(ciphertext)).toEqual({ hello: "world" });
  });

  it("still take a passphrase written out, as an older board holds one", async () => {
    setSecretStore(storeOf({}));
    const { app } = testApp();
    const encrypter = make(encrypt, app, { secret: "written out" });
    const decrypter = make(decrypt, app, { secret: "written out" });

    const ciphertext = await encrypter.process("hello");
    expect(await decrypter.process(ciphertext)).toBe("hello");
  });

  it("encrypt nothing with a secret the store does not hold", async () => {
    setSecretStore(storeOf({}));
    const { app, notifications } = testApp();
    const encrypter = make(encrypt, app, { secret: "{{secret.absent}}" });

    expect(await encrypter.process("hello")).toBeNull();
    expect(JSON.stringify(notifications)).toContain("no value stored for absent");
  });

  it("encrypt nothing with a secret bound to a host", async () => {
    // The case the audience exists for: a key pinned to somewhere on the
    // network is not a key this may quietly reuse.
    setSecretStore(
      storeOf({ pass: { value: "hunter2", audience: ["api.example.com"] } }),
    );
    const { app, notifications } = testApp();
    const encrypter = make(encrypt, app, { secret: "{{secret.pass}}" });

    expect(await encrypter.process("hello")).toBeNull();
    expect(JSON.stringify(notifications)).toContain("may only be sent to");
  });
});

describe("Sign", () => {
  it("signs with a secret held only by the store", async () => {
    setSecretStore(storeOf({ key: { value: "hunter2" } }));
    const { app } = testApp();
    const signer = make(sign, app, { secret: "{{secret.key}}" });

    const signature = await signer.process("payload");
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same signature the written-out key would", async () => {
    setSecretStore(storeOf({ key: { value: "hunter2" } }));
    const { app } = testApp();

    const viaReference = await make(sign, app, {
      secret: "{{secret.key}}",
    }).process("payload");
    const viaLiteral = await make(sign, app, { secret: "hunter2" }).process(
      "payload",
    );
    expect(viaReference).toBe(viaLiteral);
  });

  it("signs nothing, and says why, with a secret the store does not hold", async () => {
    setSecretStore(storeOf({}));
    const { app, notifications } = testApp();
    const signer = make(sign, app, { secret: "{{secret.absent}}" });

    expect(await signer.process("payload")).toBeNull();
    expect(JSON.stringify(notifications)).toContain("no value stored for absent");
  });

  it("emits nothing from a progressive run it cannot sign", async () => {
    // The progressive path signs outside process(), so an unresolvable key has
    // to stop it there too rather than emitting an unsigned or empty result.
    setSecretStore(storeOf({}));
    const { app, emitted } = testApp();
    const signer = make(sign, app, {
      method: "HmacSHA256p",
      secret: "{{secret.absent}}",
    });

    await signer.process("chunk one");
    await signer.configure({ finalize: true });
    await vi.waitFor(() => expect(emitted).toEqual([]));
  });

  it("emits a signature from a progressive run it can", async () => {
    setSecretStore(storeOf({ key: { value: "hunter2" } }));
    const { app, emitted } = testApp();
    const signer = make(sign, app, {
      method: "HmacSHA256p",
      secret: "{{secret.key}}",
    });

    await signer.process("chunk one");
    await signer.configure({ finalize: true });
    await vi.waitFor(() => expect(emitted).toHaveLength(1));
    expect(emitted[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a key bound to a host", () => {
    setSecretStore(
      storeOf({ key: { value: "hunter2", audience: ["api.example.com"] } }),
    );
    const { app } = testApp();
    const signer = make(sign, app, { secret: "{{secret.key}}" });

    return expect(signer.process("payload")).resolves.toBeNull();
  });
});

describe("the device destination", () => {
  it("is what these services resolve against", () => {
    // Named here so the constant cannot be changed to something a host could
    // also be called without a test noticing.
    expect(THIS_DEVICE).toBe("(this device)");
  });
});
