---
description: Check the vocabulary's references against a changeset and repair the ones the change invalidated
allowed-tools: Read, Edit, Bash, Grep, Glob
---

# Vocabulary check

`docs/content/vocabulary.md` maps the words this project uses about itself to the
code behind them. It is maintained by **people**: which terms belong, and which
files are worth naming, is their call.

Your job is the other half — **judging whether a change made an entry untrue**,
and repairing the references when it did.

The argument, if given, is the base to compare against (a branch, a tag, a SHA).
Default to `main`.

---

## 1. Ask the script what to look at

```bash
node scripts/vocabulary.mjs --since <base>
```

It reports three things and edits nothing:

| | Meaning | What you do |
|---|---|---|
| **dangling** | a reference resolves to nothing | Always a defect. Find where it went and fix it. |
| **uncovered** | a concept page no entry names | Tell the user; adding the entry is their call. |
| **affected** | an entry names a file this change touched | Read it. Most will still be true. |

The script matches paths literally, so it cannot see a file that was *renamed*
in this change — that surfaces as a dangling reference instead. Both lists
matter.

---

## 2. Judge each one

**A dangling reference** — find the new home before rewriting the entry:

```bash
git log --diff-filter=D --name-only -1 -- <old-path>   # when did it go
git log --follow --name-status -3 -- <new-candidate>   # was it a rename
```

Prefer `git log --follow` and a search for the symbol over guessing from the
name. If the thing genuinely no longer exists — the component was deleted, not
moved — say so and ask, because a term whose implementation is gone may need to
leave the vocabulary, and that is the user's decision.

**An affected entry** — read what actually changed in the named file:

```bash
git diff <base>...HEAD -- <file>
```

Ask three questions, in this order:

1. **Is the reference still the right file?** A component split in two, or a
   helper extracted, can leave the entry pointing at the half that no longer
   holds the thing named.
2. **Is the `#symbol` still that symbol?** A rename is the failure this whole
   check exists for. The script only tests that the name still occurs somewhere
   in the file — a symbol that moved to a *different* file it still imports
   passes the check and is still wrong.
3. **Does the description still describe it?** Not prose polish — only whether
   it now says something false. A dialog that gained a second responsibility is
   still described correctly; one that lost the responsibility named in the
   entry is not.

An entry that survives all three is fine. Say so and move on; most will.

---

## 3. What you may change, and what you may not

**May**, without asking:

- correct a reference that moved or was renamed
- correct a description that a change made false
- add a second reference to an existing entry when a term's implementation
  genuinely spans a new file

**May not**, without the user saying so:

- add a term
- remove a term
- rewrite an entry to mean something different from what it meant

If the change introduces something you think deserves a word — a new dialog, a
new subsystem, a new piece of shared vocabulary in the code review — collect
those at the end as **suggestions**, one line each with the file that would be
its reference. The user decides which become entries. Do not write them into the
document yourself.

---

## 4. Report

Finish with:

1. what you repaired, one line per entry;
2. what you checked and left alone, as a count rather than a list;
3. anything you could not resolve, and what you need to decide it;
4. suggested new terms, if any.

Then run `node scripts/vocabulary.mjs` once more so the closing state is a clean
check rather than an assertion that it is clean.
