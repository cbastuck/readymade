#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${REPO_ROOT}/build"
TOOLCHAIN="${REPO_ROOT}/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake"
FRONTEND_DIR="${REPO_ROOT}/meander/frontend"
CONFIG="${1:-Release}"
EMBEDDED_FRONTEND="${2:-ON}"

if [[ "${EMBEDDED_FRONTEND}" != "ON" && "${EMBEDDED_FRONTEND}" != "OFF" ]]; then
    echo "ERROR: Second argument must be exactly ON or OFF."
    echo "Usage: ./build.sh [Release|Debug|RelWithDebInfo|MinSizeRel] [ON|OFF]"
    exit 2
fi

if [[ "${EMBEDDED_FRONTEND}" == "OFF" && "${CONFIG}" != "Debug" && "${CONFIG}" != "debug" ]]; then
    echo "ERROR: Dev server mode only supports Debug builds."
    echo "Use: ./build.sh Debug OFF"
    exit 2
fi

echo "==> Building meander frontend"
echo "    frontend: ${FRONTEND_DIR}"
echo "    embedded frontend: ${EMBEDDED_FRONTEND}"

if [[ "${EMBEDDED_FRONTEND}" == "ON" ]]; then
    if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
        echo "==> Installing frontend dependencies"
        npm --prefix "${FRONTEND_DIR}" ci
    fi

    npm --prefix "${FRONTEND_DIR}" run build
else
    echo "==> Skipping frontend build because embedded frontend is OFF"
fi

echo "==> Building meander (config: ${CONFIG})"
echo "    repo: ${REPO_ROOT}"
echo "    build: ${BUILD_DIR}"

cmake \
    -B "${BUILD_DIR}" \
    -S "${REPO_ROOT}" \
    -DCMAKE_BUILD_TYPE="${CONFIG}" \
    -DCMAKE_OSX_ARCHITECTURES="$(uname -m)" \
    -DBUILD_HKP_SAUCER=ON \
    -DMEANDER_USE_EMBEDDED_FRONTEND="${EMBEDDED_FRONTEND}" \
    -GXcode

cmake --build "${BUILD_DIR}" --config "${CONFIG}" --parallel "$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)"

echo "==> Done: ${BUILD_DIR}"
