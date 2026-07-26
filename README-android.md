# Building Readymade for Android

The Android app (`meander-android/`) embeds the shared mobile web app in an Android `WebView`,
exposes the same `hkp://` bridge as the iOS app, and embeds `hkp-rt` as a native runtime
through a JNI shim (`app/src/main/cpp/hkp_runtime_jni.cpp`).

See [README.md](./README.md) for prerequisites shared by all platforms, and
[meander-android/README.md](./meander-android/README.md) for the app architecture
(`hkp://` routes, the injected fetch bridge, board storage, Auth0 login).

## Prerequisites

- JDK 17 — or none on `PATH`: `build-android.sh` falls back to the JDK bundled with
  Android Studio (`jbr`)
- Android SDK, API 35 (`compileSdk`), with `sdk.dir` set in `meander-android/local.properties`
- Android NDK `27.2.12479018` and CMake `3.31.6` (install both via the SDK Manager — the
  versions are pinned in `meander-android/app/build.gradle.kts`)
- Node.js + npm (for the bundled web app)

### Native dependencies (vcpkg)

The JNI build resolves Boost and OpenSSL from **prebuilt classic-mode vcpkg trees** under
`3rdparty/vcpkg/installed/<triplet>`, using the overlay triplets in
`meander-android/vcpkg-triplets/`. Unlike the desktop builds, these are not installed for you
during configure — build them once per ABI:

```bash
ANDROID_NDK_HOME=<path-to-ndk> ./3rdparty/vcpkg/vcpkg install \
    openssl boost-asio boost-beast boost-chrono boost-container boost-context \
    boost-date-time boost-filesystem boost-format boost-iostreams boost-json \
    boost-random boost-system boost-thread boost-url boost-uuid boost-variant \
    --triplet arm64-android          # and again with --triplet x64-android
```

`arm64-android` covers physical devices, `x64-android` the emulator. These are the only two
ABIs the app ships (`abiFilters = ["arm64-v8a", "x86_64"]`); `minSdk` is 26.

## Build

From the repository root:

```bash
./build-android.sh Debug            # or: ./build-android.sh Release
```

The script builds `meander/frontend` with the Android Vite target, copies the result into
`meander-android/app/src/main/assets/WebApp/`, then runs the Gradle `assemble<Config>` task
(via `meander-android/gradlew` when present).

### From Android Studio

Open `meander-android/` as the project. You don't need Gradle or a JDK on your `PATH` — but
you **do** need to bundle the web app yourself first (see below), then build/run as usual.

## Refresh the bundled web app

The bundled web app lives in `meander-android/app/src/main/assets/WebApp/`. To refresh it
with the latest frontend, run from the repo root:

```bash
npm --prefix meander/frontend run update:android
```

The Android Vite target writes its output directly into the assets directory (`emptyOutDir`
clears it first), so this single command is all the bundling required — no separate copy step.
`build-android.sh` does this for you; the Android Studio route does not.

## Output

```text
meander-android/app/build/outputs/apk/<config>/
```

For example, a `Debug` build produces the APK under `.../apk/debug/`.

## Rebuild from scratch

```bash
./meander-android/gradlew -p meander-android clean
./build-android.sh Debug
```

The prebuilt vcpkg trees under `3rdparty/vcpkg/installed/` are unaffected by `clean` and do
not need rebuilding.
