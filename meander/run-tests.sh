#!/usr/bin/env bash
#
# Tests for the Readymade app backend.
#
# These cover rules the backend keeps apart from its saucer-facing code, so the
# suite builds without saucer, vcpkg or hkp-rt — seconds, not a full app build.
set -euo pipefail

MEANDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${MEANDER_DIR}/.." && pwd)"
BUILD_DIR="${MEANDER_DIR}/build-tests"
CONFIG="${1:-Debug}"

# Reuse a Catch2 already fetched by another build rather than cloning again.
CATCH2_SRC=""
for candidate in \
  "${REPO_ROOT}/hkp-rt/build-tests/_deps/catch2-src" \
  "${REPO_ROOT}/build/_deps/catch2-src"; do
  if [[ -d "${candidate}" ]]; then
    CATCH2_SRC="${candidate}"
    break
  fi
done

declare -a CMAKE_ARGS=(
  -S "${MEANDER_DIR}/backend/tests"
  -B "${BUILD_DIR}"
  -DCMAKE_BUILD_TYPE="${CONFIG}"
)
if [[ -n "${CATCH2_SRC}" ]]; then
  CMAKE_ARGS+=(-DFETCHCONTENT_SOURCE_DIR_CATCH2="${CATCH2_SRC}")
fi

echo "==> Configuring app backend tests (${CONFIG})"
cmake "${CMAKE_ARGS[@]}"

echo "==> Building app backend tests (${CONFIG})"
JOBS="$(sysctl -n hw.logicalcpu 2>/dev/null || echo 4)"
cmake --build "${BUILD_DIR}" --parallel "${JOBS}"

echo "==> Running app backend tests"
ctest --test-dir "${BUILD_DIR}" --output-on-failure

echo "==> Done"
