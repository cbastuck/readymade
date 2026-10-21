import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * People a suite signs in for real: tokens signed with the keys
 * `jwks-server.mjs` serves, verified by hkp-node exactly as it verifies
 * Auth0's — signature, audience, verified email — and never a principal stub.
 *
 * A token is what the app keeps after signing in (`readymade-id-token`), so a
 * browser context given one is that person, to the app and to every server
 * it talks to.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const IDENTITY_DOMAIN = "e2e-identities.invalid";
export const IDENTITY_AUDIENCE = "e2e-readymade";
export const JWKS_PORT = 18090;
export const JWKS_URL = `http://127.0.0.1:${JWKS_PORT}/.well-known/jwks.json`;
export const IDENTITY_KEYS_FILE = path.resolve(
  HERE,
  "../test-results/identities/keys.json",
);

export type Person = {
  /** Stable and unique: the tenant a person's runtimes and boards live in. */
  sub: string;
  email: string;
  name: string;
};

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** An id token for `person`, valid for `seconds` from now. */
export function idToken(person: Person, seconds = 2 * 60 * 60): string {
  const keys = JSON.parse(readFileSync(IDENTITY_KEYS_FILE, "utf8")) as {
    kid: string;
    privateKey: string;
  };
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", typ: "JWT", kid: keys.kid });
  const payload = encode({
    iss: `https://${IDENTITY_DOMAIN}/`,
    aud: IDENTITY_AUDIENCE,
    sub: person.sub,
    email: person.email,
    email_verified: true,
    name: person.name,
    nickname: person.name,
    iat: now,
    exp: now + seconds,
  });
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`),
    createPrivateKey(keys.privateKey),
  ).toString("base64url");
  return `${header}.${payload}.${signature}`;
}
