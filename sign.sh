#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="${1:-${REPO_ROOT}/build/meander/Release/Meander.app}"

if [[ ! -d "${APP_PATH}" ]]; then
    echo "ERROR: App bundle not found: ${APP_PATH}" >&2
    echo "Usage: bash ./sign.sh [path/to/Meander.app]" >&2
    exit 2
fi

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
    echo "ERROR: APPLE_SIGNING_IDENTITY is required" >&2
    exit 2
fi

KEYCHAIN_PATH="${RUNNER_TEMP:-/tmp}/build-signing.keychain-db"
KEYCHAIN_PASSWORD="temp-keychain-password"
CERT_PATH="${RUNNER_TEMP:-/tmp}/signing-cert.p12"
NOTARY_ZIP="${RUNNER_TEMP:-/tmp}/meander-notary.zip"
NOTARY_KEY_PATH="${RUNNER_TEMP:-/tmp}/AuthKey_${APPLE_NOTARY_API_KEY_ID:-unknown}.p8"
ORIGINAL_KEYCHAIN_LIST=""
CREATED_KEYCHAIN="0"

if [[ -n "${APPLE_SIGNING_CERT_PATH:-}" ]]; then
    CERT_PATH="${APPLE_SIGNING_CERT_PATH}"
elif [[ -n "${APPLE_SIGNING_CERT_BASE64:-}" ]]; then
    echo "${APPLE_SIGNING_CERT_BASE64}" | base64 --decode > "${CERT_PATH}"
else
    echo "ERROR: Provide APPLE_SIGNING_CERT_PATH or APPLE_SIGNING_CERT_BASE64" >&2
    exit 2
fi

if [[ -z "${APPLE_SIGNING_CERT_PASSWORD:-}" ]]; then
    echo "ERROR: APPLE_SIGNING_CERT_PASSWORD is required" >&2
    exit 2
fi

echo "==> Creating temporary keychain"
# Save original keychain search list so we can restore it
ORIGINAL_KEYCHAIN_LIST=$(security list-keychains -d user | tr -d '"')
# Avoid stale keychain state from previous runs using the same name.
security delete-keychain "${KEYCHAIN_PATH}" >/dev/null 2>&1 || true
security create-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
CREATED_KEYCHAIN="1"
security set-keychain-settings -lut 21600 "${KEYCHAIN_PATH}"
security unlock-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
security import "${CERT_PATH}" -k "${KEYCHAIN_PATH}" -P "${APPLE_SIGNING_CERT_PASSWORD}" -A -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple: -s -k "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
# Add to keychain search list so codesign can find it
security list-keychains -d user -s "${KEYCHAIN_PATH}" $(security list-keychains -d user | tr -d '"')


# Sign inside-out: the share extension carries its own entitlements (sandbox +
# App Group), the app its own (App Group only) — a --deep sign would stamp the
# app's entitlements onto the nested .appex, so each bundle is signed explicitly.
ENTITLEMENTS_APP="${REPO_ROOT}/meander/macos/Readymade.entitlements"
ENTITLEMENTS_APPEX="${REPO_ROOT}/meander/macos/ShareExtension/ShareExtension.entitlements"
APPEX_PATH="${APP_PATH}/Contents/PlugIns/ReadymadeShareExtension.appex"

if [[ -d "${APPEX_PATH}" ]]; then
    echo "==> Signing share extension"
    /usr/bin/codesign --force --options runtime --timestamp --keychain "${KEYCHAIN_PATH}" \
        --entitlements "${ENTITLEMENTS_APPEX}" \
        --sign "${APPLE_SIGNING_IDENTITY}" "${APPEX_PATH}"
fi

echo "==> Signing app bundle"
/usr/bin/codesign --force --options runtime --timestamp --keychain "${KEYCHAIN_PATH}" \
    --entitlements "${ENTITLEMENTS_APP}" \
    --sign "${APPLE_SIGNING_IDENTITY}" "${APP_PATH}"
/usr/bin/codesign --verify --deep --strict --verbose=2 "${APP_PATH}"

if [[ -n "${APPLE_NOTARY_API_KEY_PATH:-}" ]]; then
    NOTARY_KEY_PATH="${APPLE_NOTARY_API_KEY_PATH}"
elif [[ -n "${APPLE_NOTARY_API_KEY_BASE64:-}" ]]; then
    echo "${APPLE_NOTARY_API_KEY_BASE64}" | base64 --decode > "${NOTARY_KEY_PATH}"
fi

if [[ -n "${NOTARY_KEY_PATH:-}" && -n "${APPLE_NOTARY_API_KEY_ID:-}" && -n "${APPLE_NOTARY_API_ISSUER_ID:-}" ]]; then
    echo "==> Notarizing app bundle"
    ditto -c -k --sequesterRsrc --keepParent "${APP_PATH}" "${NOTARY_ZIP}"

    xcrun notarytool submit "${NOTARY_ZIP}" \
        --key "${NOTARY_KEY_PATH}" \
        --key-id "${APPLE_NOTARY_API_KEY_ID}" \
        --issuer "${APPLE_NOTARY_API_ISSUER_ID}" \
        --wait

    xcrun stapler staple "${APP_PATH}"
    xcrun stapler validate "${APP_PATH}"
    echo "==> Notarization and stapling complete"
else
    echo "==> Notarization skipped (missing APPLE_NOTARY_API_KEY_ID / APPLE_NOTARY_API_ISSUER_ID / key)"
fi

echo "==> Signing workflow complete"
