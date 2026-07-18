cmake_minimum_required(VERSION 3.21)
project(Readymade LANGUAGES CXX VERSION 1.0)

# CPM is already included by the root CMakeLists.txt when built from there.
# When building standalone, include it from the sibling project's copy.
if(NOT COMMAND CPMAddPackage)
    include(${CMAKE_CURRENT_SOURCE_DIR}/../3rdparty/cmake/CPM.cmake)
endif()

# Saucer is fetched by the root CMakeLists.txt when building from there.
# Guard against re-fetching in standalone builds.
if(NOT TARGET saucer::saucer)
    CPMAddPackage(
        NAME      saucer
        VERSION   8.0.5
        GIT_REPOSITORY "https://github.com/saucer/saucer"
    )
    CPMAddPackage(
        NAME      saucer-loop
        VERSION   2.1.0
        GIT_REPOSITORY "https://github.com/saucer/loop"
    )
endif()

if(NOT TARGET saucer::desktop)
    CPMAddPackage(
        NAME      saucer-desktop
        VERSION   4.1.0
        GIT_REPOSITORY "https://github.com/saucer/desktop"
    )
endif()

add_executable(
  ${PROJECT_NAME}
  backend/main.cpp
  backend/schemeHandler.cpp
  backend/router.cpp
  backend/frontendServer.cpp
  backend/popupWindow.cpp
  backend/serviceRedirectHandler.cpp
)

if(APPLE)
  target_sources(${PROJECT_NAME} PRIVATE backend/main.mm backend/shareInbox.mm backend/shareRouter.cpp)
endif()


if(MSVC)
  set(CMAKE_CXX_FLAGS_RELEASE "/O2 /DNDEBUG" CACHE STRING "Release flags" FORCE)
  set(CMAKE_C_FLAGS_RELEASE   "/O2 /DNDEBUG" CACHE STRING "Release flags" FORCE)
else()
  set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -g0" CACHE STRING "Release flags" FORCE)
  set(CMAKE_C_FLAGS_RELEASE   "-O3 -DNDEBUG -g0" CACHE STRING "Release flags" FORCE)
endif()
if(CMAKE_GENERATOR STREQUAL "Xcode")
  set(CMAKE_XCODE_ATTRIBUTE_GCC_GENERATE_DEBUGGING_SYMBOLS[variant=Release] "NO")
  set(CMAKE_XCODE_ATTRIBUTE_DEBUG_INFORMATION_FORMAT[variant=Release] "dwarf")

  set_target_properties(${PROJECT_NAME} PROPERTIES
    XCODE_ATTRIBUTE_DEPLOYMENT_POSTPROCESSING[variant=Release] "YES"
    XCODE_ATTRIBUTE_STRIP_INSTALLED_PRODUCT[variant=Release] "YES"
    XCODE_ATTRIBUTE_STRIP_STYLE[variant=Release] "all"
    XCODE_ATTRIBUTE_DEAD_CODE_STRIPPING[variant=Release] "YES"
    XCODE_ATTRIBUTE_DEBUG_INFORMATION_FORMAT[variant=Release] "dwarf"
    XCODE_ATTRIBUTE_GCC_GENERATE_DEBUGGING_SYMBOLS[variant=Release] "NO"
  )

  set_property(TARGET ${PROJECT_NAME} PROPERTY INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE)
endif()

set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN 1)


if(APPLE)
  # Use CMAKE_CURRENT_SOURCE_DIR so paths are correct whether built from root or standalone
  set(APP_ICON "${CMAKE_CURRENT_SOURCE_DIR}/hkp.icns")
  set_source_files_properties(${APP_ICON} PROPERTIES
    MACOSX_PACKAGE_LOCATION "Resources"
  )
  target_sources(${PROJECT_NAME} PRIVATE ${APP_ICON})
  set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_ICON_FILE "hkp.icns"
    MACOSX_BUNDLE_GUI_IDENTIFIER "com.readymadeit.app"
    MACOSX_BUNDLE_INFO_PLIST "${CMAKE_CURRENT_SOURCE_DIR}/macos/Info.plist"
  )
  set_target_properties(${PROJECT_NAME} PROPERTIES
    XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "com.readymadeit.app"
  )
endif()

# ── Share Extension target (macOS, Xcode generator only) ─────────────────────
# "Share → Readymade" in the macOS share menu. A separate Swift .appex embedded
# in the app bundle: it captures the shared URL/text/file, drops an envelope
# into the App Group inbox (group.com.readymadeit.app), and opens the host app
# via readymade://share?id=<id>; the app's in-app picker does the rest. Mirrors
# the iOS extension target in meander-ios/CMakeLists.txt — including the .appex
# quirks debugged there (mh_execute + NSExtensionMain entry point, pinned
# PRODUCT_MODULE_NAME). ShareInbox.swift is shared with the iOS targets; the
# host app reads the inbox natively via backend/shareInbox.{h,mm}.
if(APPLE AND CMAKE_GENERATOR STREQUAL "Xcode")
  enable_language(Swift)

  add_executable(ReadymadeShareExtension MACOSX_BUNDLE
      macos/ShareExtension/ShareViewController.swift
      ${CMAKE_CURRENT_SOURCE_DIR}/../meander-ios/ReadymadeIOS/Shared/ShareInbox.swift
  )

  set_target_properties(ReadymadeShareExtension PROPERTIES
      # Make CMake emit an app-extension (.appex) rather than a standalone app.
      BUNDLE_EXTENSION "appex"
      XCODE_PRODUCT_TYPE            "com.apple.product-type.app-extension"
      # An .appex executable is a real Mach-O executable (mh_execute) with no
      # main() of its own — the entry point is NSExtensionMain, selected with
      # the -e linker flag (mh_bundle links but cannot be posix_spawn'ed).
      XCODE_ATTRIBUTE_MACH_O_TYPE   "mh_execute"
      XCODE_ATTRIBUTE_OTHER_LDFLAGS "-e _NSExtensionMain"

      # Bundle identity: an extension's id must be prefixed by the host app's.
      XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "com.readymadeit.app.ShareExtension"
      XCODE_ATTRIBUTE_MARKETING_VERSION         "1.0"
      XCODE_ATTRIBUTE_CURRENT_PROJECT_VERSION   "1"
      MACOSX_BUNDLE_INFO_PLIST
          "${CMAKE_CURRENT_SOURCE_DIR}/macos/ShareExtension/Info.plist"

      # Pin the Swift module name so NSExtensionPrincipalClass
      # (ReadymadeShareExtension.ShareViewController) resolves deterministically
      # (CMake doesn't expand $(PRODUCT_MODULE_NAME) in Info.plists).
      XCODE_ATTRIBUTE_PRODUCT_MODULE_NAME "ReadymadeShareExtension"
      XCODE_ATTRIBUTE_PRODUCT_NAME        "ReadymadeShareExtension"

      XCODE_ATTRIBUTE_SWIFT_VERSION "5.9"

      # Signing is done in POST_BUILD, not by Xcode: wiring the entitlements
      # (sandbox + App Group) through CODE_SIGN_ENTITLEMENTS makes Xcode demand
      # a provisioning profile even for ad-hoc signing, and Xcode's own sign
      # step runs *after* all build phases, clobbering any re-sign attempted
      # from a script phase. sign.sh re-signs releases with the real identity.
      XCODE_ATTRIBUTE_CODE_SIGNING_ALLOWED "NO"
  )

  # Re-sign the built .appex with its entitlements (sandbox + App Group) —
  # extensions must be sandboxed to load at all. The embed step below copies
  # it without re-signing (CODE_SIGN_ON_COPY NO) so this signature survives.
  add_custom_command(TARGET ReadymadeShareExtension POST_BUILD
      COMMAND /usr/bin/codesign --force --sign - --entitlements
              "${CMAKE_CURRENT_SOURCE_DIR}/macos/ShareExtension/ShareExtension.entitlements"
              "$<TARGET_BUNDLE_DIR:ReadymadeShareExtension>"
      COMMENT "Ad-hoc signing ReadymadeShareExtension with sandbox + App Group entitlements"
  )

  target_link_libraries(ReadymadeShareExtension PRIVATE
      "-framework Foundation"
      "-framework AppKit"
      "-framework UniformTypeIdentifiers"
  )

  # Embed and code-sign the extension inside the app's PlugIns folder so it
  # ships with Readymade.app and registers with the share menu. The app itself
  # carries the App Group entitlement so macOS 15+ doesn't prompt when it reads
  # the group container the extension writes.
  set_target_properties(${PROJECT_NAME} PROPERTIES
      XCODE_EMBED_APP_EXTENSIONS                   "ReadymadeShareExtension"
      # NO: sign-on-copy would re-sign ad-hoc *without* entitlements and strip
      # the sandbox/App Group signature applied in the extension's POST_BUILD.
      XCODE_EMBED_APP_EXTENSIONS_CODE_SIGN_ON_COPY "NO"
      # Signing happens in POST_BUILD (see the extension target for why).
      XCODE_ATTRIBUTE_CODE_SIGNING_ALLOWED "NO"
  )
  add_dependencies(${PROJECT_NAME} ReadymadeShareExtension)

  # Outer bundle last: signing the app after the .appex landed in PlugIns keeps
  # the seal over nested code intact, and stamps the App Group entitlement so
  # macOS 15+ treats the app's reads of the group container as first-party.
  add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
      COMMAND /usr/bin/codesign --force --sign - --entitlements
              "${CMAKE_CURRENT_SOURCE_DIR}/macos/Readymade.entitlements"
              "$<TARGET_BUNDLE_DIR:${PROJECT_NAME}>"
      COMMENT "Ad-hoc signing Readymade with the App Group entitlement"
  )
endif()

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_23)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 23 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

# Build the frontend and embed it using saucer_embed when enabled
option(MEANDER_USE_EMBEDDED_FRONTEND "Build and embed frontend assets into the app bundle" ON)
if(MEANDER_USE_EMBEDDED_FRONTEND)
  saucer_embed("frontend/dist" TARGET ${PROJECT_NAME})
  target_compile_definitions(${PROJECT_NAME} PRIVATE USE_SAUCER_EMBEDDED)
endif()

# Define Windows version for compatibility
if(WIN32)
  target_compile_definitions(${PROJECT_NAME} PRIVATE _WIN32_WINNT=0x0A00)  # Target Windows 10+
endif()

if (APPLE)
  set(PLATFORM_LIBS )
else()
  set(PLATFORM_LIBS)
endif()

target_link_libraries(
  ${PROJECT_NAME}
  PUBLIC
  saucer::saucer
  saucer::loop
  saucer::desktop
  hkp-rt-lib
  ${PLATFORM_LIBS}
)

if(MEANDER_USE_EMBEDDED_FRONTEND)
  target_link_libraries(${PROJECT_NAME} PUBLIC saucer::embedded)
endif()
