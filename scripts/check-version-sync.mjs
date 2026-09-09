#!/usr/bin/env node
/**
 * The app version, stated twice, checked.
 *
 * `hkp-frontend/package.json` carries the version the app is built with, and
 * the website prints a version to visitors. Two files, one number: nothing but
 * habit keeps them equal, and they live in different repositories, so a bump in
 * one is a commit that cannot touch the other.
 *
 * package.json is the source of truth. The website string wraps it in a label
 * ("Readymade v0.9.7"); only the version part is compared, so the label stays a
 * free choice.
 *
 * Working-tree files are compared, not the index — what is on disk is what a
 * person sees, and a version bump left unstaged in one repo is exactly the
 * mistake worth catching.
 *
 * Usage:
 *   node scripts/check-version-sync.mjs          # check, exit 1 on mismatch
 *   node scripts/check-version-sync.mjs --fix    # rewrite the website string
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = path.join(ROOT, "hkp-frontend", "package.json");
const CONSTANTS = path.join(ROOT, "hkp-website", "src", "pages", "constants.ts");
const CONSTANT_NAME = "APP_VERSION_STRING";

const fix = process.argv.includes("--fix");

const rel = (file) => path.relative(ROOT, file);

const fail = (message) => {
  console.error(`version-sync: ${message}`);
  process.exit(1);
};

if (!fs.existsSync(CONSTANTS)) {
  // The website is a submodule; an uninitialized checkout has nothing to compare.
  console.log(`version-sync: ${rel(CONSTANTS)} not present, skipping`);
  process.exit(0);
}

if (!fs.existsSync(PACKAGE_JSON)) {
  fail(`${rel(PACKAGE_JSON)} not found`);
}

let packageVersion;
try {
  packageVersion = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version;
} catch (error) {
  fail(`${rel(PACKAGE_JSON)} is not readable JSON: ${error.message}`);
}
if (typeof packageVersion !== "string" || packageVersion.length === 0) {
  fail(`${rel(PACKAGE_JSON)} has no "version" field`);
}

const source = fs.readFileSync(CONSTANTS, "utf8");
const declaration = new RegExp(
  `(export\\s+const\\s+${CONSTANT_NAME}\\s*(?::[^=]+)?=\\s*)(["'\`])([^"'\`]*)\\2`,
);
const match = source.match(declaration);
if (!match) {
  fail(`${rel(CONSTANTS)} declares no string constant ${CONSTANT_NAME}`);
}

const [, , , websiteString] = match;
const versionInString = websiteString.match(/\bv?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/);
if (!versionInString) {
  fail(`${CONSTANT_NAME} ("${websiteString}") contains no version number`);
}
const websiteVersion = versionInString[1];

if (websiteVersion === packageVersion) {
  console.log(`version-sync: ${packageVersion} — in sync`);
  process.exit(0);
}

if (fix) {
  const fixedString = websiteString.replace(versionInString[0], versionInString[0].replace(websiteVersion, packageVersion));
  const fixed = source.replace(declaration, (_all, prefix, quote) => `${prefix}${quote}${fixedString}${quote}`);
  fs.writeFileSync(CONSTANTS, fixed);
  console.log(`version-sync: ${rel(CONSTANTS)} updated to "${fixedString}"`);
  process.exit(0);
}

console.error(
  [
    "version-sync: the app version is stated twice and the two disagree.",
    "",
    `  ${rel(PACKAGE_JSON)}  version            ${packageVersion}`,
    `  ${rel(CONSTANTS)}  ${CONSTANT_NAME}  ${websiteVersion}  ("${websiteString}")`,
    "",
    "package.json is the source of truth. To take its version:",
    "",
    "  node scripts/check-version-sync.mjs --fix",
    "",
    `then stage ${rel(CONSTANTS)} in the hkp-website submodule.`,
  ].join("\n"),
);
process.exit(1);
