#!/usr/bin/env node
/**
 * What the vocabulary points at, checked.
 *
 * The vocabulary is written by people — which words matter and which files are
 * worth naming is not something a scan can decide. What a scan *can* do is the
 * half that rots: telling whether the files and symbols an entry names still
 * exist, and which entries a given change touched.
 *
 * Two questions, deliberately no more:
 *
 *   dangling  — a reference that resolves to nothing. Always wrong.
 *   affected  — an entry naming a file this changeset touched. Not wrong;
 *               worth a look, because that is when a rename slips through.
 *
 * It never edits the document. Judging whether an affected entry still says
 * something true is a reading task, which is what `/vocabulary` is for.
 *
 * Usage:
 *   node scripts/vocabulary.mjs                 # dangling only
 *   node scripts/vocabulary.mjs --since main    # + entries the diff touches
 *   node scripts/vocabulary.mjs --json          # machine-readable
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOCABULARY = path.join(ROOT, "docs/content/vocabulary.md");
const CONCEPTS_DIR = path.join(ROOT, "docs/content/concepts");

/**
 * Submodules hold their own history, so a diff taken in the superproject
 * reports the submodule as one changed path rather than the files inside it —
 * which are exactly the files the vocabulary names.
 */
const SUBMODULES = ["hkp-node", "hkp-python", "hkp-website"];

/**
 * A reference: a code span holding a path, optionally `#symbol`.
 *
 * Either a file with a known extension, or a directory (a trailing slash) —
 * some entries are best answered by "this folder" rather than by one file in it.
 */
const REFERENCE =
  /`([A-Za-z0-9_./-]+(?:\.(?:tsx?|jsx?|mjs|py|cpp|h|hpp|mm|json|md|go)|\/))(#[A-Za-z0-9_]+)?`/g;

function parseArgs(argv) {
  const args = { since: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--since") {
      args.since = argv[i + 1] ?? "main";
      i += 1;
    } else if (argv[i] === "--json") {
      args.json = true;
    }
  }
  return args;
}

/**
 * Every entry in the document, with the references it makes.
 *
 * An entry is a table row: the term is the first cell, in bold. Prose
 * references (the ones in this file's own explanations) belong to no row and
 * are ignored, which is why the row is the unit rather than the line.
 */
function readEntries(markdown) {
  const entries = [];
  let section = "";
  for (const [index, line] of markdown.split("\n").entries()) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim();
      continue;
    }
    const term = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
    if (!term) {
      continue;
    }
    const references = [...line.matchAll(REFERENCE)].map((match) => ({
      file: match[1],
      symbol: match[2] ? match[2].slice(1) : null,
    }));
    entries.push({ term: term[1], section, line: index + 1, references });
  }
  return entries;
}

/**
 * Where a reference resolves from.
 *
 * `concepts/board.md` and `services/queue.md` are how the docs name each other
 * — relative to `docs/content`, which is what makes the same spelling work in a
 * checkout and on the website. Everything else is a path from the repo root.
 */
function resolveReference(file) {
  // A page under docs/content, named the way the documents name each other.
  // Asked as a question about the file rather than kept as a list of them, so a
  // new page needs no edit here.
  const inDocs = path.join(ROOT, "docs/content", file);
  if (fs.existsSync(inDocs)) {
    return inDocs;
  }
  return path.join(ROOT, file);
}

/** Whether a reference still resolves, and why not when it does not. */
function checkReference(reference) {
  const target = resolveReference(reference.file);
  if (!fs.existsSync(target)) {
    return reference.file.endsWith("/") ? "no such directory" : "no such file";
  }
  if (reference.file.endsWith("/") || !reference.symbol) {
    return null;
  }
  // A plain text search, not a parse: the question is whether the name still
  // occurs in the file it was attributed to, and every way of declaring one
  // (function, const, type, class, C++ method) writes the name.
  const source = fs.readFileSync(target, "utf8");
  const occurs = new RegExp(`\\b${reference.symbol}\\b`).test(source);
  return occurs ? null : `no "${reference.symbol}" in the file`;
}

/** Concept pages with no entry naming them — the coverage rule, checked. */
function missingConcepts(entries) {
  if (!fs.existsSync(CONCEPTS_DIR)) {
    return [];
  }
  const named = entries.flatMap((entry) =>
    entry.references.map((reference) => reference.file),
  );
  // Concepts are referenced as `concepts/<slug>.md` in the "What it is" cell.
  const mentioned = new Set(
    named
      .filter((file) => file.startsWith("concepts/"))
      .map((file) => path.basename(file, ".md")),
  );
  return fs
    .readdirSync(CONCEPTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.basename(file, ".md"))
    .filter((slug) => !mentioned.has(slug));
}

/**
 * The files a changeset touched, submodules included.
 *
 * Best-effort per repository: a submodule that has no such ref (a branch name
 * that means nothing there) contributes nothing rather than failing the run.
 */
function changedFiles(since) {
  const run = (command, cwd) => {
    try {
      return execSync(command, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const files = new Set();
  const collect = (cwd, prefix) => {
    const add = (file) => files.add(prefix ? `${prefix}/${file}` : file);
    for (const file of run(`git diff --name-only ${since}...HEAD`, cwd)) {
      add(file);
    }
    // Uncommitted work counts too: the point is to catch a rename before it
    // lands, not after. `git status` names the file after its two status
    // columns; a rename is written "old -> new" and both halves matter.
    for (const line of run("git status --porcelain", cwd)) {
      for (const part of line.slice(3).trim().split(" -> ")) {
        add(part);
      }
    }
  };

  collect(ROOT, "");
  for (const submodule of SUBMODULES) {
    const cwd = path.join(ROOT, submodule);
    if (fs.existsSync(cwd)) {
      collect(cwd, submodule);
    }
  }
  return files;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(VOCABULARY)) {
    console.error(`No vocabulary at ${path.relative(ROOT, VOCABULARY)}`);
    process.exit(1);
  }

  const entries = readEntries(fs.readFileSync(VOCABULARY, "utf8"));
  const dangling = [];
  for (const entry of entries) {
    for (const reference of entry.references) {
      const problem = checkReference(reference);
      if (problem) {
        dangling.push({
          term: entry.term,
          line: entry.line,
          reference: reference.symbol
            ? `${reference.file}#${reference.symbol}`
            : reference.file,
          problem,
        });
      }
    }
  }

  const uncovered = missingConcepts(entries);

  let affected = [];
  if (args.since) {
    const changed = changedFiles(args.since);
    affected = entries
      .map((entry) => ({
        term: entry.term,
        line: entry.line,
        touched: entry.references
          .map((reference) => reference.file)
          .filter((file) => changed.has(file)),
      }))
      .filter((entry) => entry.touched.length > 0);
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        { entries: entries.length, dangling, uncovered, affected },
        null,
        2,
      ),
    );
  } else {
    console.log(`${entries.length} vocabulary entries.`);
    if (dangling.length) {
      console.log(`\n${dangling.length} reference(s) point at nothing:`);
      for (const item of dangling) {
        console.log(`  ${item.term} (line ${item.line}): ${item.reference} — ${item.problem}`);
      }
    } else {
      console.log("Every reference resolves.");
    }
    if (uncovered.length) {
      console.log(`\nConcepts with no entry: ${uncovered.join(", ")}`);
    }
    if (args.since) {
      if (affected.length) {
        console.log(
          `\n${affected.length} entr(ies) name a file this change touched — check they still read true:`,
        );
        for (const item of affected) {
          console.log(`  ${item.term} (line ${item.line}): ${item.touched.join(", ")}`);
        }
      } else {
        console.log(`\nNothing this change touched is named in the vocabulary.`);
      }
    }
  }

  // Dangling references and uncovered concepts are failures; affected entries
  // are a reading list, and failing on those would make every change to a named
  // file a red build.
  process.exit(dangling.length || uncovered.length ? 1 : 0);
}

main();
