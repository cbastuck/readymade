#!/usr/bin/env bash
#
# fetch-review-comments.sh
#
# Fetches inline PR review comments from a Codeberg (Gitea/Forgejo) repository
# and prints them as a clean "path:line — comment" list.
#
# Usage:
#   ./fetch-review-comments.sh <PR_NUMBER>
#   ./fetch-review-comments.sh <PR_NUMBER> --json          # raw JSON instead of formatted list
#   ./fetch-review-comments.sh <PR_NUMBER> --repo owner/repo
#
# Requires:
#   - CODEBERG_TOKEN environment variable set (Codeberg Settings -> Applications)
#   - curl, jq
#
# Repo detection:
#   By default, the script tries to auto-detect "owner/repo" from the git
#   remote "origin" of the current directory. Override with --repo, or set
#   the CODEBERG_REPO env var (format: owner/repo).

set -euo pipefail

BASE_URL="https://codeberg.org/api/v1"
OUTPUT_FORMAT="text"
REPO_OVERRIDE=""
PR_NUMBER=""

usage() {
  echo "Usage: $0 <PR_NUMBER> [--json] [--repo owner/repo]" >&2
  exit 1
}

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      OUTPUT_FORMAT="json"
      shift
      ;;
    --repo)
      REPO_OVERRIDE="${2:-}"
      [[ -z "$REPO_OVERRIDE" ]] && usage
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
for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' not found. Install it (e.g. 'brew install $cmd')." >&2
    exit 1
  fi
done

# --- Check token ---
if [[ -z "${CODEBERG_TOKEN:-}" ]]; then
  echo "Error: CODEBERG_TOKEN is not set. Run: export CODEBERG_TOKEN=<your token>" >&2
  exit 1
fi

# --- Determine owner/repo ---
REPO_SLUG="${REPO_OVERRIDE:-${CODEBERG_REPO:-}}"

if [[ -z "$REPO_SLUG" ]]; then
  # Try to auto-detect from git remote "origin"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ORIGIN_URL="$(git config --get remote.origin.url || true)"
    # Handle both SSH (git@codeberg.org:owner/repo.git) and HTTPS
    # (https://codeberg.org/owner/repo.git) remote URL formats.
    if [[ "$ORIGIN_URL" =~ codeberg\.org[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
      REPO_SLUG="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    fi
  fi
fi

if [[ -z "$REPO_SLUG" ]]; then
  echo "Error: could not determine owner/repo." >&2
  echo "Run this from inside the repo, or pass --repo owner/repo, or set CODEBERG_REPO." >&2
  exit 1
fi

OWNER="${REPO_SLUG%%/*}"
REPO="${REPO_SLUG##*/}"

echo "Fetching review comments for ${OWNER}/${REPO} PR #${PR_NUMBER}..." >&2

AUTH_HEADER="Authorization: token ${CODEBERG_TOKEN}"

# --- Fetch all reviews on the PR ---
REVIEWS_URL="${BASE_URL}/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/reviews"
REVIEWS_JSON="$(curl -s -H "$AUTH_HEADER" "$REVIEWS_URL")"

# Basic sanity check on the response (e.g. auth errors, 404s come back as an object with "message")
if echo "$REVIEWS_JSON" | jq -e 'type == "object" and has("message")' >/dev/null 2>&1; then
  ERR_MSG="$(echo "$REVIEWS_JSON" | jq -r '.message')"
  echo "Error from Codeberg API: $ERR_MSG" >&2
  exit 1
fi

REVIEW_IDS="$(echo "$REVIEWS_JSON" | jq -r '.[].id')"

if [[ -z "$REVIEW_IDS" ]]; then
  echo "No reviews found on PR #${PR_NUMBER}." >&2
  exit 0
fi

# --- Fetch comments for each review, collect into one JSON array ---
ALL_COMMENTS="[]"
while read -r review_id; do
  [[ -z "$review_id" ]] && continue
  COMMENTS_URL="${BASE_URL}/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/reviews/${review_id}/comments"
  COMMENTS_JSON="$(curl -s -H "$AUTH_HEADER" "$COMMENTS_URL")"
  ALL_COMMENTS="$(jq -s '.[0] + .[1]' <(echo "$ALL_COMMENTS") <(echo "$COMMENTS_JSON"))"
done <<< "$REVIEW_IDS"

# --- Output ---
if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  echo "$ALL_COMMENTS" | jq '.'
else
  COUNT="$(echo "$ALL_COMMENTS" | jq 'length')"
  if [[ "$COUNT" -eq 0 ]]; then
    echo "No inline comments found on PR #${PR_NUMBER}." >&2
    exit 0
  fi
  echo "$ALL_COMMENTS" | jq -r '.[] | "\(.path):\(.line // .position // "?") — \(.body)"'
fi