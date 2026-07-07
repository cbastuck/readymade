---
description: Pull your inline review comments from a Codeberg PR and work through them in the working copy (never commit)
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: <PR_NUMBER>
---

# Work through Codeberg PR review comments

The user has opened a PR on Codeberg and left inline review comments on it. Your job is to
pull those comments with the repo's helper script and address them in the working copy —
**as changes only, never commits**.

The PR number is: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user for the PR number before doing anything else.

---

## Hard rules — read these first

These are non-negotiable and override any other instinct you may have:

1. **Never commit.** Do not run `git commit`, `git add`, `git push`, `git rebase`, or any
   command that writes to git history or the remote. Leave every change in the working copy
   only.
2. **Never write to the repository or the PR.** Do not post replies to Codeberg, do not
   update the PR, do not create commits or branches. Pushing and merging are exclusively the
   user's responsibility. Your output is edits to files in the working tree.
3. **Ask back whenever you are uncertain.** The user would much rather answer a question than
   have you guess wrong. If a comment's intent, scope, or desired direction is unclear —
   stop and ask before editing. This is especially true for design changes (see below).
4. **The user has the final call.** Offer your best work and reasoning, but the user decides.

---

## Step 1 — Pull the comments

Run the helper script from the repo root. The token is expected to already be resolvable
from the environment (`CODEBERG_TOKEN`); the repo (`owner/repo`) is auto-detected from the
git remote.

```bash
./pull_review_comments.sh $ARGUMENTS
```

For richer context (diff hunks, exact positions) when a plain `path:line — body` line is not
enough to locate or understand a comment, re-run with `--json`:

```bash
./pull_review_comments.sh $ARGUMENTS --json
```

If the script errors:
- **`CODEBERG_TOKEN is not set`** — tell the user; suggest they run the command themselves
  with `! ./pull_review_comments.sh $ARGUMENTS` so the token from their shell is picked up,
  or export it. Do not try to work around it.
- **`No reviews / No inline comments found`** — report that there's nothing to do and stop.
- **Any API error** — surface it to the user verbatim and stop.

---

## Step 2 — Understand each comment in context

For every comment returned:

1. Open the referenced file at the referenced line and read enough surrounding code to
   understand what the comment is actually about.
2. Read the comment carefully. Classify the intent — this determines how you proceed:
   - **Concrete fix** ("this is a bug", "rename this", "handle the null case") — implement it.
   - **Design change / direction** ("I'd rather this were structured as…", "what if we
     pushed this into a service", "let's explore doing X instead") — these matter most to the
     user. Some are firm design decisions; some are the user thinking out loud and exploring a
     different area. **Do not assume which.** If the desired end-state or scope is not
     unambiguous from the comment, ask before implementing.
   - **Question** ("why is this here?", "does this handle X?") — answer it for the user in
     your summary; only change code if the answer implies a change and the change is clear.
3. Keep HKP's architecture and design principles (see `CLAUDE.md`) in mind — composability,
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
to the PR when satisfied, re-review async on Codeberg, and you'll repeat this cycle with the
next round of comments until they merge.
