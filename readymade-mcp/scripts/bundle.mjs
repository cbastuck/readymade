#!/usr/bin/env node
// Writes what the knowledge server indexes, and the server's own sources, into
// a fresh directory as they are committed — never the working tree — so a
// deployed server needs no git and cannot serve an untracked, ignored or
// edited file. Runs where git is: a development machine or CI.
//
//   npm run bundle                       → readymade-mcp/bundle, replaced each run
//   node scripts/bundle.mjs --out <dir>  → a directory that must not exist yet
//                           [--root <checkout>]
//
// The commits the bundle was made from go into readymade-mcp-commits.json,
// which the server reads for provenance in place of `.git`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// The folders src/repository.ts indexes; keep the two lists in step.
const superprojectPaths = [
  "docs/content",
  "boards",
  "hkp-frontend/src/runtime/browser",
  "hkp-rt/lib",
  "readymade-mcp/package.json",
  "readymade-mcp/package-lock.json",
  "readymade-mcp/tsconfig.json",
  "readymade-mcp/src",
];
// Ignored by git, and only ever written by this script, so it is safe to
// replace; a directory named with --out is never removed.
const defaultOut = path.resolve(import.meta.dirname, "../bundle");
const submodules = [
  { name: "hkp-node", paths: ["src"] },
  { name: "hkp-python", paths: ["src/hkp"] },
];

function parseArguments(argv) {
  const result = { root: path.resolve(import.meta.dirname, "../.."), out: defaultOut };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") result.root = path.resolve(argv[++index]);
    else if (argv[index] === "--out") result.out = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { maxBuffer: 1024 * 1024 * 1024 });

function exists(cwd, commit, file) {
  try {
    git(cwd, "cat-file", "-e", `${commit}:${file}`);
    return true;
  } catch {
    return false;
  }
}

function extract(cwd, commit, paths, out, prefix = "") {
  const present = paths.filter((file) => exists(cwd, commit, file));
  if (!present.length) return;
  const archive = git(cwd, "archive", "--format=tar", `--prefix=${prefix}`, commit, "--", ...present);
  execFileSync("tar", ["-x", "-C", out], { input: archive });
}

const { root, out } = parseArguments(process.argv.slice(2));
if (out === defaultOut) rmSync(out, { recursive: true, force: true });
else if (existsSync(out)) throw new Error(`${out} already exists; a bundle is written into a fresh directory.`);
const commit = git(root, "rev-parse", "HEAD").toString().trim();
mkdirSync(out, { recursive: true });
extract(root, commit, superprojectPaths, out);
const commits = { readymade: commit };
for (const submodule of submodules) {
  // The commit the superproject records, not whatever is checked out there.
  const entry = git(root, "ls-tree", commit, submodule.name).toString().trim();
  if (!entry) continue;
  const recorded = entry.split(/\s+/)[2];
  const worktree = path.join(root, submodule.name);
  if (!existsSync(path.join(worktree, ".git"))) {
    console.warn(`Skipping ${submodule.name}: the submodule is not checked out.`);
    continue;
  }
  extract(worktree, recorded, submodule.paths, out, `${submodule.name}/`);
  commits[submodule.name] = recorded;
}
writeFileSync(path.join(out, "readymade-mcp-commits.json"), `${JSON.stringify(commits, null, 2)}\n`);
if (git(root, "status", "--porcelain").toString().trim())
  console.warn("The working tree has uncommitted changes; they are not in the bundle.");
console.log(`Bundled ${commit} into ${out}`);
