#!/usr/bin/env bash
set -euo pipefail

HKP_RT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${HKP_RT_DIR}/build-tests"
CONFIG="${1:-Debug}"
SUITE="${2:-all}" # all | runtime | services

usage() {
  echo "Usage: $(basename "$0") [Debug|Release|RelWithDebInfo|MinSizeRel] [all|runtime|services]"
}

if [[ "$SUITE" != "all" && "$SUITE" != "runtime" && "$SUITE" != "services" ]]; then
  usage
  exit 2
fi

echo "==> Configuring hkp-rt tests"
cmake \
  -S "${HKP_RT_DIR}" \
  -B "${BUILD_DIR}" \
  -DCMAKE_BUILD_TYPE="${CONFIG}" \
  -DBUILD_TESTING=ON \
  -DBUILD_HKP_SAUCER=OFF

echo "==> Building hkp-rt tests (${CONFIG})"
JOBS="$(sysctl -n hw.logicalcpu 2>/dev/null || echo 4)"
case "$SUITE" in
  all)
    cmake --build "${BUILD_DIR}" --parallel "${JOBS}"
    ;;
  runtime)
    cmake --build "${BUILD_DIR}" --target hkp-rt-runtime-tests --parallel "${JOBS}"
    ;;
  services)
    cmake --build "${BUILD_DIR}" --target hkp-rt-service-tests --parallel "${JOBS}"
    ;;
esac

run_runtime_binary() {
  local bin="${BUILD_DIR}/tests/hkp-rt-runtime-tests"
  if [[ ! -x "$bin" ]]; then
    echo "ERROR: Runtime test binary not found: $bin"
    exit 1
  fi
  "$bin"
}

run_service_binary() {
  local bin="${BUILD_DIR}/tests/hkp-rt-service-tests"
  if [[ ! -x "$bin" ]]; then
    echo "ERROR: Service test binary not found: $bin"
    exit 1
  fi
  "$bin"
}

echo "==> Running test suite: ${SUITE}"
case "$SUITE" in
  all)
    ctest --test-dir "${BUILD_DIR}" --output-on-failure
    ;;
  runtime)
    run_runtime_binary
    ;;
  services)
    run_service_binary
    ;;
esac

echo "==> Done"
