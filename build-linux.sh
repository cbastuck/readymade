#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${REPO_ROOT}/build-linux"
TOOLCHAIN="${REPO_ROOT}/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake"
VCPKG_MANIFEST_DIR="${REPO_ROOT}/3rdparty"
VCPKG_OVERLAY_TRIPLETS_DIR="${REPO_ROOT}/3rdparty/vcpkg-triplets"
VCPKG_CACHE_ROOT="${REPO_ROOT}/.cache/vcpkg"
VCPKG_BINARY_CACHE_DIR="${VCPKG_CACHE_ROOT}/binary"
VCPKG_DOWNLOADS_DIR="${VCPKG_CACHE_ROOT}/downloads"
FRONTEND_DIR="${REPO_ROOT}/meander/frontend"
HKP_FRONTEND_DIR="${REPO_ROOT}/hkp-frontend"
CONFIG="${1:-Release}"
EMBEDDED_FRONTEND="${2:-ON}"
VCPKG_TARGET_TRIPLET=""

if [[ "${EMBEDDED_FRONTEND}" != "ON" && "${EMBEDDED_FRONTEND}" != "OFF" ]]; then
    echo "ERROR: Second argument must be exactly ON or OFF."
    echo "Usage: ./build-linux.sh [Release|Debug|RelWithDebInfo|MinSizeRel] [ON|OFF]"
    exit 2
fi

if [[ "${EMBEDDED_FRONTEND}" == "OFF" && "${CONFIG}" != "Debug" && "${CONFIG}" != "debug" ]]; then
    echo "ERROR: Dev server mode only supports Debug builds."
    echo "Use: ./build-linux.sh Debug OFF"
    exit 2
fi

IS_DEBUG_CONFIG="OFF"
if [[ "${CONFIG}" == "Debug" || "${CONFIG}" == "debug" ]]; then
    IS_DEBUG_CONFIG="ON"
fi

if ! command -v pkg-config >/dev/null 2>&1; then
    echo "ERROR: Missing required tool: pkg-config"
    echo "Install it with: sudo apt install pkg-config"
    exit 2
fi

if ! command -v nasm >/dev/null 2>&1; then
    echo "ERROR: Missing required tool: nasm"
    echo "Install it with: sudo apt install nasm"
    exit 2
fi

if ! pkg-config --exists "gtk4 >= 4.12"; then
    echo "ERROR: Missing required development package: gtk4 >= 4.12"
    echo "Install it with: sudo apt install libgtk-4-dev"
    exit 2
fi

if ! pkg-config --exists "libadwaita-1"; then
    echo "ERROR: Missing required development package: libadwaita-1"
    echo "Install it with: sudo apt install libadwaita-1-dev"
    exit 2
fi

if ! pkg-config --exists "json-glib-1.0"; then
    echo "ERROR: Missing required development package: json-glib-1.0"
    echo "Install it with: sudo apt install libjson-glib-dev"
    exit 2
fi

if ! pkg-config --exists "webkitgtk-6.0"; then
    echo "ERROR: Missing required development package: webkitgtk-6.0"
    echo "Install it with: sudo apt install libwebkitgtk-6.0-dev"
    exit 2
fi

# Detect Linux architecture and set appropriate vcpkg triplet
LINUX_ARCHITECTURE="$(uname -m)"
if [[ "${LINUX_ARCHITECTURE}" == "aarch64" ]]; then
    if [[ "${IS_DEBUG_CONFIG}" == "ON" ]]; then
        VCPKG_TARGET_TRIPLET="arm64-linux"
    else
        VCPKG_TARGET_TRIPLET="arm64-linux-release"
    fi
elif [[ "${LINUX_ARCHITECTURE}" == "x86_64" ]]; then
    if [[ "${IS_DEBUG_CONFIG}" == "ON" ]]; then
        VCPKG_TARGET_TRIPLET="x64-linux"
    else
        VCPKG_TARGET_TRIPLET="x64-linux-release"
    fi
else
    echo "ERROR: Unsupported Linux architecture: ${LINUX_ARCHITECTURE}"
    echo "Supported architectures: x86_64, aarch64"
    exit 2
fi

echo "==> Building meander frontend"
echo "    frontend: ${FRONTEND_DIR}"
echo "    embedded frontend: ${EMBEDDED_FRONTEND}"

if [[ "${EMBEDDED_FRONTEND}" == "ON" ]]; then
    if [[ ! -d "${HKP_FRONTEND_DIR}/node_modules" ]]; then
        echo "==> Installing hkp-frontend dependencies"
        npm --prefix "${HKP_FRONTEND_DIR}" ci
    fi

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
echo "    architecture: ${LINUX_ARCHITECTURE}"
if [[ "${IS_DEBUG_CONFIG}" == "ON" ]]; then
    echo "    note: Debug build keeps symbols and skips stripping by design"
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

if [[ ! -f "${TOOLCHAIN}" ]]; then
    echo "==> vcpkg not found, bootstrapping..."

    retry() {
        local attempts="$1"
        shift
        local n=1
        until "$@"; do
            if [[ "${n}" -ge "${attempts}" ]]; then
                return 1
            fi
            n=$((n + 1))
            sleep $((n * 2))
        done
    }

    vcpkg_baseline="bba8b52f6dea74159bba855ef00376e588d6ea0a"
    if [[ ! -f "${REPO_ROOT}/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake" ]]; then
        retry 5 git clone https://github.com/microsoft/vcpkg.git "${REPO_ROOT}/3rdparty/vcpkg"
    fi
    retry 5 git -C "${REPO_ROOT}/3rdparty/vcpkg" fetch origin "${vcpkg_baseline}"
    git -C "${REPO_ROOT}/3rdparty/vcpkg" checkout --force "${vcpkg_baseline}"
    retry 3 "${REPO_ROOT}/3rdparty/vcpkg/bootstrap-vcpkg.sh" -disableMetrics
fi

if [[ ! -f "${VCPKG_MANIFEST_DIR}/vcpkg.json" ]]; then
    echo "ERROR: Missing vcpkg manifest: ${VCPKG_MANIFEST_DIR}/vcpkg.json"
    exit 2
fi

if [[ "${IS_DEBUG_CONFIG}" != "ON" && -n "${VCPKG_TARGET_TRIPLET}" && ! -f "${VCPKG_OVERLAY_TRIPLETS_DIR}/${VCPKG_TARGET_TRIPLET}.cmake" ]]; then
    echo "ERROR: Missing vcpkg overlay triplet: ${VCPKG_OVERLAY_TRIPLETS_DIR}/${VCPKG_TARGET_TRIPLET}.cmake"
    exit 2
fi

echo "    vcpkg manifest: ${VCPKG_MANIFEST_DIR}/vcpkg.json"
if [[ -n "${VCPKG_TARGET_TRIPLET}" ]]; then
    echo "    vcpkg triplet: ${VCPKG_TARGET_TRIPLET}"
fi
if [[ "${IS_DEBUG_CONFIG}" != "ON" ]]; then
    echo "    vcpkg overlay triplets: ${VCPKG_OVERLAY_TRIPLETS_DIR}"
fi
echo "    vcpkg binary sources: ${VCPKG_BINARY_SOURCES}"
echo "    vcpkg downloads: ${VCPKG_DOWNLOADS}"

CMAKE_ARGS=(
    -B "${BUILD_DIR}"
    -S "${REPO_ROOT}"
    -DCMAKE_BUILD_TYPE="${CONFIG}"
    -DVCPKG_MANIFEST_DIR="${VCPKG_MANIFEST_DIR}"
    -DBUILD_HKP_SAUCER=ON
    -DMEANDER_USE_EMBEDDED_FRONTEND="${EMBEDDED_FRONTEND}"
    -GNinja
)

if [[ "${IS_DEBUG_CONFIG}" != "ON" ]]; then
    # Ensure non-Debug binaries do not carry debug symbols.
    CMAKE_ARGS+=(
        "-DCMAKE_C_FLAGS_RELEASE=-O3 -DNDEBUG -g0"
        "-DCMAKE_CXX_FLAGS_RELEASE=-O3 -DNDEBUG -g0"
        "-DCMAKE_C_FLAGS_MINSIZEREL=-Os -DNDEBUG -g0"
        "-DCMAKE_CXX_FLAGS_MINSIZEREL=-Os -DNDEBUG -g0"
        "-DCMAKE_C_FLAGS_RELWITHDEBINFO=-O2 -DNDEBUG -g0"
        "-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=-O2 -DNDEBUG -g0"
    )
fi

if [[ -n "${VCPKG_TARGET_TRIPLET}" ]]; then
    CMAKE_ARGS+=("-DVCPKG_TARGET_TRIPLET=${VCPKG_TARGET_TRIPLET}")
fi

if [[ "${IS_DEBUG_CONFIG}" != "ON" ]]; then
    CMAKE_ARGS+=("-DVCPKG_OVERLAY_TRIPLETS=${VCPKG_OVERLAY_TRIPLETS_DIR}")
fi

cmake "${CMAKE_ARGS[@]}"

cmake --build "${BUILD_DIR}" --config "${CONFIG}" --parallel "$(nproc 2>/dev/null || echo 1)"

if [[ "${IS_DEBUG_CONFIG}" != "ON" ]]; then
    if command -v strip >/dev/null 2>&1; then
        echo "==> Stripping non-Debug ELF executables"
        strip_count=0
        while IFS= read -r -d '' binary; do
            file_desc="$(file -b "${binary}" 2>/dev/null || true)"
            if [[ "${file_desc}" == ELF* ]] && [[ "${file_desc}" == *"executable"* ]]; then
                size_before="$(stat -c%s "${binary}" 2>/dev/null || echo 0)"
                if strip --strip-unneeded "${binary}"; then
                    size_after="$(stat -c%s "${binary}" 2>/dev/null || echo 0)"
                    echo "    stripped: ${binary} (${size_before} -> ${size_after} bytes)"
                    strip_count=$((strip_count + 1))
                else
                    echo "WARNING: Failed to strip ${binary}" >&2
                fi
            fi
        done < <(find "${BUILD_DIR}" -type f -print0)

        if [[ "${strip_count}" -eq 0 ]]; then
            echo "WARNING: No ELF executables were stripped under ${BUILD_DIR}." >&2
        fi

        if [[ -f "${BUILD_DIR}/meander/meander" ]]; then
            echo "==> Final meander binary info"
            ls -lh "${BUILD_DIR}/meander/meander"
            file "${BUILD_DIR}/meander/meander"
        fi
    else
        echo "WARNING: strip tool not found; non-Debug binaries may still include symbols."
    fi
else
    echo "==> Skipping strip for Debug build"
fi

echo "==> Done: ${BUILD_DIR}"
