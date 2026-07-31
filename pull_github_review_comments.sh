#!/usr/bin/env bash
#
# pull_github_review_comments.sh
#
# Fetches inline PR review comments (and review summary bodies) from a GitHub
# repository and prints them as a clean "path:line — comment" list.
#
# Usage:
#   ./pull_github_review_comments.sh <PR_NUMBER>
#   ./pull_github_review_comments.sh <PR_NUMBER> --json              # raw JSON instead of formatted list
#   ./pull_github_review_comments.sh <PR_NUMBER> --repo owner/repo
#   ./pull_github_review_comments.sh <PR_NUMBER> --author @me        # only threads started by that login
#   ./pull_github_review_comments.sh <PR_NUMBER> --all               # include resolved threads
#
# Requires:
#   - gh (GitHub CLI), authenticated: gh auth status
#   - jq
#
# Repo detection:
#   Uses gh's own detection (which picks the github.com remote even when
#   "origin" points elsewhere). Override with --repo, or set GITHUB_REPO
#   (format: owner/repo).
#
# Notes:
#   - Resolved threads are skipped by default; pass --all to include them.
#   - Threads marked (outdated) sit on a diff hunk that later commits changed;
#     the line number may no longer match the current file.

set -euo pipefail

OUTPUT_FORMAT="text"
REPO_OVERRIDE=""
AUTHOR_FILTER=""
INCLUDE_RESOLVED="false"
PR_NUMBER=""

usage() {
  echo "Usage: $0 <PR_NUMBER> [--json] [--repo owner/repo] [--author LOGIN|@me] [--all]" >&2
  exit 1
}

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      OUTPUT_FORMAT="json"
      shift
      ;;
    --all)
      INCLUDE_RESOLVED="true"
      shift
      ;;
    --repo)
      REPO_OVERRIDE="${2:-}"
      [[ -z "$REPO_OVERRIDE" ]] && usage
      shift 2
      ;;
    --author)
      AUTHOR_FILTER="${2:-}"
      [[ -z "$AUTHOR_FILTER" ]] && usage
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "$PR_NUMBER" ]]; then
        PR_NUMBER="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        usage
      fi
      ;;
  esac
done

if [[ -z "$PR_NUMBER" ]]; then
  usage
fi

if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "Error: PR_NUMBER must be a number, got '$PR_NUMBER'" >&2
  exit 1
fi

# --- Check dependencies ---
for cmd in gh jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' not found. Install it (e.g. 'brew install $cmd')." >&2
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# --- Determine owner/repo ---
REPO_SLUG="${REPO_OVERRIDE:-${GITHUB_REPO:-}}"

if [[ -z "$REPO_SLUG" ]]; then
  REPO_SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi

if [[ -z "$REPO_SLUG" ]]; then
  echo "Error: could not determine owner/repo." >&2
  echo "Run this from inside the repo, or pass --repo owner/repo, or set GITHUB_REPO." >&2
  exit 1
fi

OWNER="${REPO_SLUG%%/*}"
REPO="${REPO_SLUG##*/}"

# --- Resolve "@me" to the authenticated login ---
if [[ "$AUTHOR_FILTER" == "@me" ]]; then
  AUTHOR_FILTER="$(gh api user -q .login)"
fi

echo "Fetching review comments for ${OWNER}/${REPO} PR #${PR_NUMBER}..." >&2

# --- Fetch review threads + review summaries in one GraphQL query ---
# REST exposes neither thread grouping nor resolved state, so use GraphQL.
read -r -d '' QUERY <<'GRAPHQL' || true
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      title
      url
      reviewThreads(first: 100) {
        nodes {
          isResolved
          isOutdated
          path
          line
          originalLine
          comments(first: 50) {
            nodes {
              author { login }
              body
              diffHunk
              createdAt
              url
            }
          }
        }
      }
      reviews(first: 100) {
        nodes {
          author { login }
          body
          state
          submittedAt
          url
        }
      }
    }
  }
}
GRAPHQL

RESPONSE="$(gh api graphql \
  -f query="$QUERY" \
  -F owner="$OWNER" \
  -F repo="$REPO" \
  -F pr="$PR_NUMBER" 2>&1)" || {
  echo "Error from GitHub API: $RESPONSE" >&2
  exit 1
}

PR_JSON="$(echo "$RESPONSE" | jq '.data.repository.pullRequest')"

if [[ "$PR_JSON" == "null" || -z "$PR_JSON" ]]; then
  echo "Error: PR #${PR_NUMBER} not found in ${OWNER}/${REPO}." >&2
  exit 1
fi

# --- Filter threads: resolved state, then author of the thread's first comment ---
THREADS="$(echo "$PR_JSON" | jq \
  --argjson includeResolved "$INCLUDE_RESOLVED" \
  --arg author "$AUTHOR_FILTER" '
  [ .reviewThreads.nodes[]
    | select($includeResolved or (.isResolved | not))
    | select($author == "" or (.comments.nodes[0].author.login // "") == $author)
  ]')"

# Review summary bodies (the "overall" comment on a review), non-empty only.
SUMMARIES="$(echo "$PR_JSON" | jq \
  --arg author "$AUTHOR_FILTER" '
  [ .reviews.nodes[]
    | select((.body // "") != "")
    | select($author == "" or (.author.login // "") == $author)
  ]')"

# --- Output ---
if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  jq -n \
    --argjson pr "$(echo "$PR_JSON" | jq '{title, url}')" \
    --argjson threads "$THREADS" \
    --argjson summaries "$SUMMARIES" \
    '{pullRequest: $pr, reviewThreads: $threads, reviewSummaries: $summaries}'
  exit 0
fi

THREAD_COUNT="$(echo "$THREADS" | jq 'length')"
SUMMARY_COUNT="$(echo "$SUMMARIES" | jq 'length')"

if [[ "$THREAD_COUNT" -eq 0 && "$SUMMARY_COUNT" -eq 0 ]]; then
  if [[ "$INCLUDE_RESOLVED" == "true" ]]; then
    echo "No review comments found on PR #${PR_NUMBER}." >&2
  else
    echo "No unresolved review comments found on PR #${PR_NUMBER} (pass --all to include resolved)." >&2
  fi
  exit 0
fi

if [[ "$SUMMARY_COUNT" -gt 0 ]]; then
  echo "$SUMMARIES" | jq -r '.[] | "[review \(.state) by \(.author.login // "?")] \(.body)\n"'
fi

echo "$THREADS" | jq -r '
  .[]
  | (.path) as $path
  | (.line // .originalLine // "?") as $lineNo
  | (if .isOutdated then " (outdated)" else "" end) as $outdated
  | (if .isResolved then " (resolved)" else "" end) as $resolved
  | (.comments.nodes | to_entries | map(
      if .key == 0 then
        "\($path):\($lineNo)\($outdated)\($resolved) — [\(.value.author.login // "?")] \(.value.body)"
      else
        "    ↳ [\(.value.author.login // "?")] \(.value.body)"
      end
    ) | join("\n"))
  + "\n"
'
