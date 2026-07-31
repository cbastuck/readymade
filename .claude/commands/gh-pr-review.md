---
description: Pull your inline review comments from a GitHub PR and work through them in the working copy (never commit)
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: <PR_NUMBER>
---

# Work through GitHub PR review comments

The user has opened a PR on GitHub and left inline review comments on it. Your job is to
pull those comments with the repo's helper script and address them in the working copy —
**as changes only, never commits**.

The PR number is: **$ARGUMENTS**

If `$ARGUMENTS` is empty, run `gh pr list` and ask the user which PR they mean before doing
anything else.

---

## Hard rules — read these first

These are non-negotiable and override any other instinct you may have:

1. **Never commit.** Do not run `git commit`, `git add`, `git push`, `git rebase`, or any
   command that writes to git history or the remote. Leave every change in the working copy
   only.
2. **Never write to the repository or the PR.** Do not post replies to GitHub, do not resolve
   threads, do not update the PR, do not create commits or branches. Only ever use `gh` in a
   read-only way (`gh pr list`, `gh pr view`, `gh api` GET). Pushing and merging are
   exclusively the user's responsibility. Your output is edits to files in the working tree.
3. **Ask back whenever you are uncertain.** The user would much rather answer a question than
   have you guess wrong. If a comment's intent, scope, or desired direction is unclear —
   stop and ask before editing. This is especially true for design changes (see below).
4. **The user has the final call.** Offer your best work and reasoning, but the user decides.

---

## Step 1 — Pull the comments

Run the helper script from the repo root. Auth comes from the `gh` CLI; the repo
(`owner/repo`) is auto-detected via `gh` — note that in this repo `origin` points at
Codeberg and the GitHub remote is named `github`, which `gh` handles on its own.

```bash
./pull_github_review_comments.sh $ARGUMENTS
```

Output is one block per **review thread**:

```
path:line — [author] first comment
    ↳ [author] reply
```

Threads already **resolved** on GitHub are skipped by default — that is intentional, the user
resolved them because they are done. Threads flagged `(outdated)` sit on a diff hunk that
later commits changed, so the line number may not match the current file; locate those by the
surrounding code in the diff hunk instead (use `--json`). Review summary bodies (the overall
comment on a review, not attached to a line) are printed first when present.

Useful flags:

```bash
./pull_github_review_comments.sh $ARGUMENTS --json            # diff hunks, exact line data, thread metadata
./pull_github_review_comments.sh $ARGUMENTS --author @me      # only the user's own threads (drops bot/teammate reviews)
./pull_github_review_comments.sh $ARGUMENTS --all             # include resolved threads
./pull_github_review_comments.sh $ARGUMENTS --repo owner/repo # when auto-detection is wrong (e.g. a submodule)
```

Use `--json` whenever a plain `path:line — body` line is not enough to locate or understand a
comment; it carries the `diffHunk` the comment was anchored to.

If the script errors:
- **`gh is not authenticated`** — tell the user to run `gh auth login`. Do not try to work
  around it with tokens.
- **`No unresolved review comments found`** — report that there's nothing to do and stop
  (optionally suggest `--all` if the user expected something).
- **Any API error** — surface it to the user verbatim and stop.

**Submodules.** This repo nests several repos (`hkp-frontend`, `hkp-node`, `hkp-python`, …).
A PR's comments may point at paths inside them; the paths in the output are relative to the
PR's repo root, so resolve them from the directory that repo is checked out in. If the PR
lives in a submodule rather than the superproject, run the script from that submodule's
directory or pass `--repo`.

---

## Step 2 — Understand each comment in context

For every thread returned:

1. Open the referenced file at the referenced line and read enough surrounding code to
   understand what the comment is actually about.
2. **Read the whole thread, not just the first comment.** Replies (`↳`) often narrow, retract,
   or answer the opening comment — the last word in a thread usually decides what to do.
3. Read the comment carefully. Classify the intent — this determines how you proceed:
   - **Concrete fix** ("this is a bug", "rename this", "handle the null case") — implement it.
   - **Design change / direction** ("I'd rather this were structured as…", "what if we
     pushed this into a service", "let's explore doing X instead") — these matter most to the
     user. Some are firm design decisions; some are the user thinking out loud and exploring a
     different area. **Do not assume which.** If the desired end-state or scope is not
     unambiguous from the comment, ask before implementing.
   - **Question** ("why is this here?", "does this handle X?") — answer it for the user in
     your summary; only change code if the answer implies a change and the change is clear.
4. Keep HKP's architecture and design principles (see `CLAUDE.md`) in mind — composability,
   structured flow over wires, services scoped by concept. A comment proposing a design shift
   should be realized in a way that fits these principles.

---

## Step 3 — Ask when uncertain (do this liberally)

Before editing anything ambiguous, ask the user. Good reasons to ask:

- A design comment could be interpreted more than one way, or its scope is unclear
  (this one comment, or a broader refactor?).
- The comment seems to conflict with existing code, another comment, or `CLAUDE.md`.
- Fixing it "properly" would touch a lot more than the commented spot.
- You're unsure whether the user wants a real change or was just exploring an idea.

Use the AskUserQuestion tool for focused choices; batch related questions so you're not
pinging the user repeatedly. It's fine to address the clear-cut comments first and ask about
the ambiguous ones in one round.

---

## Step 4 — Implement

- Make the smallest change that fully addresses each comment; match the surrounding code's
  style, naming, and idioms (e.g. this repo requires curly braces on all TS control-flow
  bodies).
- If the change spans runtimes or needs a matching test/docs/board update per the repo's
  conventions, do the whole thing — don't leave it half-wired.
- Do **not** stage or commit. Just edit the files.

---

## Step 5 — Report back

When done (or when you've done the clear items and are waiting on answers), give the user a
concise per-comment summary:

- **`path:line`** — the comment (short) → what you did, or the question you need answered.

Group by: **done**, **needs your input**, and **intentionally left alone** (with why).
Remind the user the changes are sitting in the working copy for them to review; they'll push
to the PR when satisfied, re-review async on GitHub (resolving threads as they go, which drops
them from the next run), and you'll repeat this cycle with the next round of comments until
they merge.
