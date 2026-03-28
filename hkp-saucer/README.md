# Make the iconset

mkdir hkp.iconset
sips -z 16 16 hkp-logo.png --out hkp.iconset/icon_16x16.png
sips -z 32 32 hkp-logo.png --out hkp.iconset/icon_16x16@2x.png
sips -z 32 32 hkp-logo.png --out hkp.iconset/icon_32x32.png
sips -z 64 64 hkp-logo.png --out hkp.iconset/icon_32x32@2x.png
sips -z 128 128 hkp-logo.png --out hkp.iconset/icon_128x128.png
sips -z 256 256 hkp-logo.png --out hkp.iconset/icon_128x128@2x.png
sips -z 256 256 hkp-logo.png --out hkp.iconset/icon_256x256.png
sips -z 512 512 hkp-logo.png --out hkp.iconset/icon_256x256@2x.png
sips -z 512 512 hkp-logo.png --out hkp.iconset/icon_512x512.png
cp hkp-logo.png hkp.iconset/icon_512x512@2x.png
iconutil -c icns hkp.iconset

# Sign the app with entitlements

codesign --deep --force --sign "Developer ID Application: Your Name (TEAMID)" \
 --entitlements hkp-saucer.entitlements hkp-saucer.app

# Verify entitlements

codesign -d --entitlements :- hkp-saucer.app

# Clean Building on CMD (MacOS arm64 Release)

In hookup root folder

1. cmake --build build_arm64 --target clean --config Release
2. cmake -B build_arm64 -G Xcode -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_TOOLCHAIN_FILE=./hkp-rt/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake -DVCPKG_TARGET_TRIPLET=arm64-osx -DVCPKG_MANIFEST_DIR=./hkp-rt/3rdparty -DINTEGRATE_HKP_PYTHON=OFF
3. cmake --build build_arm64 --config Release
