#!/usr/bin/env bash
# make_icon.sh — convert a PNG into a macOS .icns application icon
#
# Usage:
#   ./make_icon.sh <input.png>
#
# What it does:
#   1. Pads the source PNG to a square canvas (white background) if it isn't
#      already square.
#   2. Generates all 10 sizes required by macOS into hkp.iconset/.
#   3. Runs iconutil to compile hkp.icns from the iconset.
#   4. Copies the square PNG over hkp-logo.png.
#
# Replacing the icon in the application:
#   The CMakeLists.txt in this directory already references hkp.icns:
#
#     set(APP_ICON "${CMAKE_CURRENT_SOURCE_DIR}/hkp.icns")
#     MACOSX_BUNDLE_ICON_FILE "hkp.icns"
#
#   After running this script, simply rebuild the app:
#
#     ./build.sh [Release|Debug] [ON|OFF]
#
#   Xcode / CMake will embed the new hkp.icns into the app bundle automatically.
#   If you are building inside Xcode directly, clean the build folder first
#   (Product → Clean Build Folder) so Xcode picks up the changed asset.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICONSET="${SCRIPT_DIR}/hkp.iconset"

# ── Validate input ────────────────────────────────────────────────────────────
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <input.png>"
    exit 1
fi

INPUT="$1"
if [[ ! -f "${INPUT}" ]]; then
    echo "Error: file not found: ${INPUT}"
    exit 1
fi

echo "==> Source: ${INPUT}"

# ── Make square if needed ─────────────────────────────────────────────────────
W=$(sips -g pixelWidth  "${INPUT}" | awk '/pixelWidth/  { print $2 }')
H=$(sips -g pixelHeight "${INPUT}" | awk '/pixelHeight/ { print $2 }')
echo "    dimensions: ${W}x${H}"

SQUARE_SRC=/tmp/make_icon_square.png
if [[ "${W}" -eq "${H}" ]]; then
    cp "${INPUT}" "${SQUARE_SRC}"
    echo "    already square — no padding needed"
else
    SIDE=$(( W > H ? W : H ))
    sips --padToHeightWidth "${SIDE}" "${SIDE}" --padColor FFFFFF \
        "${INPUT}" -o "${SQUARE_SRC}" > /dev/null
    echo "    padded to ${SIDE}x${SIDE} (white background)"
fi

# ── Generate iconset ──────────────────────────────────────────────────────────
echo "==> Generating iconset → ${ICONSET}/"
mkdir -p "${ICONSET}"

sips -z 16   16   "${SQUARE_SRC}" --out "${ICONSET}/icon_16x16.png"    > /dev/null
sips -z 32   32   "${SQUARE_SRC}" --out "${ICONSET}/icon_16x16@2x.png" > /dev/null
sips -z 32   32   "${SQUARE_SRC}" --out "${ICONSET}/icon_32x32.png"    > /dev/null
sips -z 64   64   "${SQUARE_SRC}" --out "${ICONSET}/icon_32x32@2x.png" > /dev/null
sips -z 128  128  "${SQUARE_SRC}" --out "${ICONSET}/icon_128x128.png"    > /dev/null
sips -z 256  256  "${SQUARE_SRC}" --out "${ICONSET}/icon_128x128@2x.png" > /dev/null
sips -z 256  256  "${SQUARE_SRC}" --out "${ICONSET}/icon_256x256.png"    > /dev/null
sips -z 512  512  "${SQUARE_SRC}" --out "${ICONSET}/icon_256x256@2x.png" > /dev/null
sips -z 512  512  "${SQUARE_SRC}" --out "${ICONSET}/icon_512x512.png"    > /dev/null
sips -z 1024 1024 "${SQUARE_SRC}" --out "${ICONSET}/icon_512x512@2x.png" > /dev/null
echo "    10 sizes written"

# ── Compile .icns ─────────────────────────────────────────────────────────────
ICNS="${SCRIPT_DIR}/hkp.icns"
echo "==> Compiling ${ICNS}"
iconutil -c icns "${ICONSET}" -o "${ICNS}"

# ── Update hkp-logo.png ───────────────────────────────────────────────────────
cp "${SQUARE_SRC}" "${SCRIPT_DIR}/hkp-logo.png"
echo "==> Updated hkp-logo.png"

echo "==> Done. Rebuild with: ./build.sh Debug OFF"
