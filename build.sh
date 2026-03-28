#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${REPO_ROOT}/build"
TOOLCHAIN="${REPO_ROOT}/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake"
FRONTEND_DIR="${REPO_ROOT}/meander/frontend"
CONFIG="${1:-Release}"

echo "==> Building meander frontend"
echo "    frontend: ${FRONTEND_DIR}"

if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    echo "==> Installing frontend dependencies"
    npm --prefix "${FRONTEND_DIR}" ci
fi

npm --prefix "${FRONTEND_DIR}" run build

echo "==> Building meander (config: ${CONFIG})"
echo "    repo: ${REPO_ROOT}"
echo "    build: ${BUILD_DIR}"

if [[ ! -d "${BUILD_DIR}" ]]; then
    cmake \
        -B "${BUILD_DIR}" \
        -S "${REPO_ROOT}" \
        -DCMAKE_BUILD_TYPE="${CONFIG}" \
        -DBUILD_HKP_SAUCER=ON \
        -DENABLE_FFMPEG=OFF
else
    echo "==> Skipping configure; build directory already exists"
fi

cmake --build "${BUILD_DIR}" --config "${CONFIG}" --parallel "$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)"

echo "==> Done: ${BUILD_DIR}"
