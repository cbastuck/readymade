#!/usr/bin/env node
/**
 * Signing keys for a suite that signs people in for real.
 *
 * Makes one RSA key pair per start, serves its public half as a JWKS — what
 * hkp-node is pointed at through HKP_TEST_JWKS_URI — and writes the private
 * half where the suite's own process can sign with it (`identities.ts`). A
 * fresh pair per start means a token from an earlier run is worth nothing.
 *
 *   node support/jwks-server.mjs <port> <keys-file>
 */
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const [port, keysFile] = process.argv.slice(2);
if (!port || !keysFile) {
  console.error("usage: jwks-server.mjs <port> <keys-file>");
  process.exit(2);
}

const kid = `e2e-${randomUUID()}`;
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwks = JSON.stringify({
  keys: [{ ...publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" }],
});

mkdirSync(path.dirname(keysFile), { recursive: true });
writeFileSync(
  keysFile,
  JSON.stringify({ kid, privateKey: privateKey.export({ format: "pem", type: "pkcs8" }) }),
  { mode: 0o600 },
);

const server = http.createServer((req, res) => {
  if (req.url === "/.well-known/jwks.json") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(jwks);
    return;
  }
  // What Playwright polls to know the server is up.
  res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/plain" });
  res.end(req.url === "/" ? "ok" : "not found");
});

server.listen(Number(port), "127.0.0.1");

const stop = () => {
  rmSync(keysFile, { force: true });
  server.close(() => process.exit(0));
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
