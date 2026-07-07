#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${REPO_ROOT}/meander/frontend"
ANDROID_DIR="${REPO_ROOT}/meander-android"

CONFIG="${1:-Debug}" # Debug | Release

case "${CONFIG}" in
    Debug|Release) ;;
    *)
        echo "ERROR: Config must be Debug or Release."
        echo "Usage: ./build-android.sh [Debug|Release]"
        exit 2
        ;;
esac

echo "==> Building MeanderAndroid"
echo "    config: ${CONFIG}"

echo "==> Building mobile web app"
if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    npm --prefix "${FRONTEND_DIR}" ci
fi
npm --prefix "${FRONTEND_DIR}" run build:android

# Gradle needs a JDK. Prefer an existing JAVA_HOME, otherwise fall back to the
# JDK bundled with Android Studio (macOS/Linux) so the script works even when
# `java` isn't on PATH.
if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
    for candidate in \
        "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
        "${HOME}/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
        "${HOME}/.local/share/JetBrains/Toolbox/apps/android-studio/jbr" \
        "/opt/android-studio/jbr"; do
        if [[ -x "${candidate}/bin/java" ]]; then
            export JAVA_HOME="${candidate}"
            break
        fi
    done
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
    echo "ERROR: No JDK found. Set JAVA_HOME to a JDK (e.g. Android Studio's" >&2
    echo "       bundled 'jbr') and re-run." >&2
    exit 3
fi
echo "==> Using JAVA_HOME=${JAVA_HOME}"

TASK="assemble${CONFIG}"
if [[ -x "${ANDROID_DIR}/gradlew" ]]; then
    "${ANDROID_DIR}/gradlew" -p "${ANDROID_DIR}" "${TASK}"
else
    gradle -p "${ANDROID_DIR}" "${TASK}"
fi

echo ""
CONFIG_LOWER="$(printf '%s' "${CONFIG}" | tr '[:upper:]' '[:lower:]')"
echo "==> Done: ${ANDROID_DIR}/app/build/outputs/apk/${CONFIG_LOWER}/"
