#!/usr/bin/env bash
#
# Point both repositories at the versioned hooks in .githooks.
#
# Hooks are not carried by a clone, and the version this project states twice
# sits in two repositories: hkp-frontend/package.json in the superproject,
# hkp-website/src/pages/constants.ts in the hkp-website submodule. A commit in
# either one can break the pair, so both need the hook. core.hooksPath is
# relative to each repository's own working tree, which keeps the setting
# independent of where the checkout lives.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

git -C "${ROOT}" config core.hooksPath .githooks
echo "installed: superproject -> .githooks"

if [ -e "${ROOT}/hkp-website/.git" ]; then
  git -C "${ROOT}/hkp-website" config core.hooksPath ../.githooks
  echo "installed: hkp-website  -> ../.githooks"
else
  echo "skipped:   hkp-website submodule is not checked out"
fi
