#!/usr/bin/env bash
set -euo pipefail

HKP_RT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${HKP_RT_DIR}/.." && pwd)"
BUILD_DIR="${HKP_RT_DIR}/build-tests"
CONFIG="${1:-Debug}"
SUITE="${2:-all}" # all | runtime | services
OSX_ARCHITECTURES="$(uname -m)"
VCPKG_TARGET_TRIPLET=""
VCPKG_OVERLAY_TRIPLETS_DIR="${REPO_ROOT}/3rdparty/vcpkg-triplets"
TOOLCHAIN="${REPO_ROOT}/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake"
VCPKG_MANIFEST_DIR="${REPO_ROOT}/3rdparty"
VCPKG_CACHE_ROOT="${REPO_ROOT}/.cache/vcpkg"
VCPKG_BINARY_CACHE_DIR="${VCPKG_CACHE_ROOT}/binary"
VCPKG_DOWNLOADS_DIR="${VCPKG_CACHE_ROOT}/downloads"

# Always use Release vcpkg artifacts for tests, regardless of CONFIG
if [[ "${OSX_ARCHITECTURES}" == "arm64" ]]; then
    VCPKG_TARGET_TRIPLET="arm64-osx-release"
elif [[ "${OSX_ARCHITECTURES}" == "x86_64" ]]; then
    VCPKG_TARGET_TRIPLET="x64-osx-release"
fi

# Set up vcpkg environment if not already set
if [[ -z "${VCPKG_BINARY_SOURCES:-}" ]]; then
    export VCPKG_BINARY_SOURCES="clear;files,${VCPKG_BINARY_CACHE_DIR},readwrite"
fi

if [[ -z "${VCPKG_DOWNLOADS:-}" ]]; then
    export VCPKG_DOWNLOADS="${VCPKG_DOWNLOADS_DIR}"
fi

if [[ -z "${VCPKG_FEATURE_FLAGS:-}" ]]; then
    export VCPKG_FEATURE_FLAGS="manifests,binarycaching"
fi

usage() {
  echo "Usage: $(basename "$0") [Debug|Release|RelWithDebInfo|MinSizeRel] [all|runtime|services]"
}

if [[ "$SUITE" != "all" && "$SUITE" != "runtime" && "$SUITE" != "services" ]]; then
  usage
  exit 2
fi

echo "==> Configuring hkp-rt tests (${CONFIG})"
cmake \
  -S "${HKP_RT_DIR}" \
  -B "${BUILD_DIR}" \
  -DCMAKE_TOOLCHAIN_FILE="${TOOLCHAIN}" \
  -DVCPKG_MANIFEST_DIR="${VCPKG_MANIFEST_DIR}" \
  -DCMAKE_BUILD_TYPE="${CONFIG}" \
  -DCMAKE_OSX_ARCHITECTURES="${OSX_ARCHITECTURES}" \
  -DVCPKG_TARGET_TRIPLET="${VCPKG_TARGET_TRIPLET}" \
  -DVCPKG_OVERLAY_TRIPLETS="${VCPKG_OVERLAY_TRIPLETS_DIR}" \
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
