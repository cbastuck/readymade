# Building Readymade for Android

The Android app (`meander-android/`) embeds the mobile web app (`meander/frontend`) in an Android `WebView`, exposes the `hkp://` platform bridge, and runs `hkp-rt` in-process via JNI (`app/src/main/cpp/hkp_runtime_jni.cpp`).

See [meander-android/README.md](./meander-android/README.md) for the Android bridge architecture.

## Prerequisites

- JDK 17 (if not on `PATH`, `build-android.sh` falls back to Android Studio's bundled `jbr`)
- Android SDK (API 35 `compileSdk`, `minSdk` 26), with `sdk.dir` set in `meander-android/local.properties`
- Android NDK `27.2.12479018` and CMake `3.31.6` (installed via SDK Manager; pinned in `meander-android/app/build.gradle.kts`)
- Node.js + npm

### Native dependencies (one-time vcpkg setup)

Unlike the desktop builds, the Android JNI build reads prebuilt vcpkg trees under `3rdparty/vcpkg/installed/<triplet>` using the overlay triplets in `meander-android/vcpkg-triplets/`. Build them once per ABI (`arm64-android` for devices, `x64-android` for the emulator):

```bash
ANDROID_NDK_HOME=<path-to-ndk> ./3rdparty/vcpkg/vcpkg install \
    openssl boost-asio boost-beast boost-chrono boost-container boost-context \
    boost-date-time boost-filesystem boost-format boost-iostreams boost-json \
    boost-random boost-system boost-thread boost-url boost-uuid boost-variant \
    --triplet arm64-android          # repeat with --triplet x64-android for emulator
```

## Build (recommended)

From the repository root:

```bash
./build-android.sh Debug            # or: ./build-android.sh Release
```

This bundles `meander/frontend` into `meander-android/app/src/main/assets/WebApp/` and runs the Gradle `assemble<Config>` task.

### Building from Android Studio

Open `meander-android/` in Android Studio. Before building or running from the IDE, refresh the bundled web app from the repository root:

```bash
npm --prefix meander/frontend run update:android
```

## Output

```text
meander-android/app/build/outputs/apk/<config>/
```

## Rebuild from scratch

```bash
./meander-android/gradlew -p meander-android clean
./build-android.sh Debug
```

`clean` leaves the prebuilt vcpkg trees in `3rdparty/vcpkg/installed/` intact.
