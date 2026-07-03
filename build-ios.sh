#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${REPO_ROOT}/meander/frontend"
IOS_SOURCE_DIR="${REPO_ROOT}/meander-ios"
TOOLCHAIN="${REPO_ROOT}/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake"
VCPKG_MANIFEST_DIR="${IOS_SOURCE_DIR}"
VCPKG_CACHE_ROOT="${REPO_ROOT}/.cache/vcpkg"
VCPKG_BINARY_CACHE_DIR="${VCPKG_CACHE_ROOT}/binary"
VCPKG_DOWNLOADS_DIR="${VCPKG_CACHE_ROOT}/downloads"

TARGET="${1:-device}"   # device | simulator
CONFIG="${2:-Release}"  # Release | Debug | RelWithDebInfo | MinSizeRel

case "${TARGET}" in
    device)
        VCPKG_TARGET_TRIPLET="arm64-ios"
        CMAKE_SYSROOT="iphoneos"
        BUILD_DIR="${REPO_ROOT}/build/meander-ios-device"
        ;;
    simulator)
        VCPKG_TARGET_TRIPLET="arm64-ios-simulator"
        CMAKE_SYSROOT="iphonesimulator"
        BUILD_DIR="${REPO_ROOT}/build/meander-ios-simulator"
        ;;
    *)
        echo "ERROR: First argument must be 'device' or 'simulator'."
        echo "Usage: ./build-ios.sh [device|simulator] [Release|Debug|RelWithDebInfo|MinSizeRel]"
        exit 2
        ;;
esac

case "${CONFIG}" in
    Release|Debug|RelWithDebInfo|MinSizeRel) ;;
    *)
        echo "ERROR: Config must be Release, Debug, RelWithDebInfo, or MinSizeRel."
        echo "Usage: ./build-ios.sh [device|simulator] [Release|Debug|RelWithDebInfo|MinSizeRel]"
        exit 2
        ;;
esac

echo "==> Building ReadymadeIOS"
echo "    target:  ${TARGET} (${CMAKE_SYSROOT})"
echo "    config:  ${CONFIG}"
echo "    triplet: ${VCPKG_TARGET_TRIPLET}"
echo "    build:   ${BUILD_DIR}"

if [[ ! -f "${TOOLCHAIN}" ]]; then
    echo "ERROR: Missing vcpkg toolchain: ${TOOLCHAIN}"
    echo "Ensure vcpkg is initialized at 3rdparty/vcpkg before running build-ios.sh"
    exit 2
fi

mkdir -p "${VCPKG_BINARY_CACHE_DIR}" "${VCPKG_DOWNLOADS_DIR}"

if [[ -z "${VCPKG_BINARY_SOURCES:-}" ]]; then
    export VCPKG_BINARY_SOURCES="clear;files,${VCPKG_BINARY_CACHE_DIR},readwrite"
fi
if [[ -z "${VCPKG_DOWNLOADS:-}" ]]; then
    export VCPKG_DOWNLOADS="${VCPKG_DOWNLOADS_DIR}"
fi
if [[ -z "${VCPKG_FEATURE_FLAGS:-}" ]]; then
    export VCPKG_FEATURE_FLAGS="manifests,binarycaching"
fi

echo "    vcpkg manifest:      ${VCPKG_MANIFEST_DIR}/vcpkg.json"
echo "    vcpkg binary cache:  ${VCPKG_BINARY_CACHE_DIR}"

echo "==> Building mobile web app"
if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    echo "    Installing frontend dependencies"
    npm --prefix "${FRONTEND_DIR}" ci
fi
npm --prefix "${FRONTEND_DIR}" run build:ios

cmake \
    -B "${BUILD_DIR}" \
    -S "${IOS_SOURCE_DIR}" \
    -DCMAKE_TOOLCHAIN_FILE="${TOOLCHAIN}" \
    -DCMAKE_SYSTEM_NAME=iOS \
    -DCMAKE_OSX_SYSROOT="${CMAKE_SYSROOT}" \
    -DCMAKE_OSX_ARCHITECTURES=arm64 \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0 \
    -DCMAKE_BUILD_TYPE="${CONFIG}" \
    -DVCPKG_TARGET_TRIPLET="${VCPKG_TARGET_TRIPLET}" \
    -DVCPKG_MANIFEST_DIR="${VCPKG_MANIFEST_DIR}" \
    -DBUILD_HKP_SAUCER=OFF \
    -DENABLE_FFMPEG=OFF \
    -GXcode

cmake --build "${BUILD_DIR}" --config "${CONFIG}" --parallel "$(sysctl -n hw.logicalcpu)"

echo ""
echo "==> Done: ${BUILD_DIR}"
echo "    Xcode project: ${BUILD_DIR}/ReadymadeIOS.xcodeproj"
