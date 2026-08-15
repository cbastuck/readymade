cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-rt-deps VERSION 1.0 LANGUAGES CXX)

include(cmake/CPM.cmake)

# =============================================================================
# CPM packages — must all be fetched BEFORE vcpkg is included so that
# packageProject() ALIAS targets are created before vcpkg wraps add_library.
# =============================================================================

# sherpa-onnx — in-process speech inference for the speech-to-text (Whisper) and
# text-to-speech (Kokoro) services' local backend. Uses onnxruntime (fetched by
# sherpa itself), a separate symbol space from llama.cpp's ggml, so the two ML
# stacks coexist without a duplicate-ggml clash. Off for iOS/Android for the same
# reason as llama.cpp: those builds fall back to the services' server backend.
#
# Declared FIRST because sherpa unconditionally add_subdirectory()s its own
# nlohmann/json, creating the `nlohmann_json` target. Adding it before our own
# nlohmann_json (which is then guarded with NOT TARGET below) lets the whole
# build share one json target instead of colliding on a duplicate add_library.
if(IOS OR ANDROID)
    set(_HKP_SPEECH_DEFAULT OFF)
else()
    set(_HKP_SPEECH_DEFAULT ON)
endif()
option(HKP_SPEECH_ENABLED "Embed sherpa-onnx for the speech-to-text/text-to-speech local backends" ${_HKP_SPEECH_DEFAULT})

if(HKP_SPEECH_ENABLED)
    CPMAddPackage(
        NAME sherpa_onnx
        GIT_REPOSITORY "https://github.com/k2-fsa/sherpa-onnx"
        GIT_TAG v1.13.4
        OPTIONS
            "SHERPA_ONNX_ENABLE_C_API ON"
            "SHERPA_ONNX_ENABLE_TTS ON"
            "SHERPA_ONNX_ENABLE_PORTAUDIO OFF"
            "SHERPA_ONNX_ENABLE_WEBSOCKET OFF"
            "SHERPA_ONNX_ENABLE_BINARY OFF"
            "SHERPA_ONNX_ENABLE_TESTS OFF"
            "SHERPA_ONNX_ENABLE_CHECK OFF"
            "SHERPA_ONNX_ENABLE_PYTHON OFF"
            "SHERPA_ONNX_ENABLE_JNI OFF"
            "SHERPA_ONNX_ENABLE_SPEAKER_DIARIZATION OFF"
            "BUILD_SHARED_LIBS OFF"
    )
endif()

# inflect — the vendored Inflect v2 TTS pipeline (3rdparty/inflect), the
# text-to-speech service's second local backend. Needs espeak-ng for
# grapheme-to-phoneme and onnxruntime for inference, both of which sherpa-onnx
# already fetches: with HKP_SPEECH_ENABLED this costs no new third-party code,
# and without it the pair is far smaller than sherpa's stack (no kaldi, no
# openfst, no piper-phonemize), which is what makes a local voice viable on
# mobile. The two options are independent so a build can take either, both, or
# neither.
#
# Declared AFTER sherpa so the reuse checks below see sherpa's targets.
if(IOS OR ANDROID)
    set(_HKP_INFLECT_DEFAULT OFF)
else()
    set(_HKP_INFLECT_DEFAULT ON)
endif()
option(HKP_INFLECT_ENABLED "Embed the inflect TTS pipeline for the text-to-speech inflect backend" ${_HKP_INFLECT_DEFAULT})

if(HKP_INFLECT_ENABLED)
    include(FetchContent)

    # ── espeak-ng ────────────────────────────────────────────────────────────
    # Regular (non-imported) targets are visible across directory scopes, so
    # sherpa's copy is detectable by name. When it is absent, fetch the same
    # fork at the same commit sherpa pins: two static espeak-ng archives in one
    # binary would collide on symbols, so the version is a build-wide singleton
    # either way, and pinning the same one keeps the two configurations
    # identical. Phoneme output is fixed by the *data directory*, not by the
    # code version, so this choice does not affect what either engine says.
    if(NOT TARGET espeak-ng)
        set(BUILD_ESPEAK_NG_TESTS OFF CACHE BOOL "" FORCE)
        # Also gates data.cmake, which compiles ~19 MB of dictionaries for 40+
        # languages. The service takes its data directory as a runtime path
        # (an en-US-only set is 824 KB), so the build never needs to produce one.
        set(BUILD_ESPEAK_NG_EXE OFF CACHE BOOL "" FORCE)
        set(USE_ASYNC OFF CACHE BOOL "" FORCE)
        set(USE_MBROLA OFF CACHE BOOL "" FORCE)
        set(USE_LIBSONIC OFF CACHE BOOL "" FORCE)
        set(USE_LIBPCAUDIO OFF CACHE BOOL "" FORCE)
        set(USE_KLATT OFF CACHE BOOL "" FORCE)
        set(USE_SPEECHPLAYER OFF CACHE BOOL "" FORCE)
        FetchContent_Declare(espeak_ng
            URL      "https://github.com/csukuangfj/espeak-ng/archive/ed530aa113046142eb5115cf2fc9157854d0ffe1.zip"
            URL_HASH "SHA256=e4e262cbe34f7fe21f91f1ba3397f2728e1f30eafbae7853f2b753a9ed13f0dd"
        )
        # MakeAvailable rather than Populate + add_subdirectory: CMake 4 removed
        # the ability to call FetchContent_Populate with declared details.
        FetchContent_MakeAvailable(espeak_ng)
        message(STATUS "hkp-rt-deps: inflect fetched its own espeak-ng")
    else()
        message(STATUS "hkp-rt-deps: inflect reuses sherpa-onnx's espeak-ng")
    endif()

    # sherpa populates espeak_ng inside a function, so its espeak_ng_SOURCE_DIR
    # never reaches this scope. FetchContent's registry is global and answers
    # for either path.
    FetchContent_GetProperties(espeak_ng)
    if(NOT espeak_ng_SOURCE_DIR)
        message(FATAL_ERROR "HKP_INFLECT_ENABLED: could not locate the espeak-ng source directory")
    endif()

    # ── onnxruntime ──────────────────────────────────────────────────────────
    # sherpa creates its `onnxruntime` as a non-GLOBAL IMPORTED target, which is
    # scoped to its own directory and therefore invisible here — `if(TARGET
    # onnxruntime)` would wrongly report absent and download a second, different
    # copy. Probe the FetchContent state instead, which is global, and reuse the
    # unpacked archive by path. When sherpa is off, fetch the prebuilt package
    # inflect was developed against.
    FetchContent_GetProperties(onnxruntime)
    if(onnxruntime_POPULATED)
        set(_hkp_ort_root "${onnxruntime_SOURCE_DIR}")
        message(STATUS "hkp-rt-deps: inflect reuses sherpa-onnx's onnxruntime")
    else()
        set(HKP_INFLECT_ORT_VERSION "1.28.0" CACHE STRING "ONNX Runtime version fetched for the inflect backend")
        if(APPLE)
            if(CMAKE_SYSTEM_PROCESSOR MATCHES "arm64|aarch64")
                set(_ort_platform "osx-arm64")
            else()
                set(_ort_platform "osx-x86_64")
            endif()
        elseif(WIN32)
            set(_ort_platform "win-x64")
        elseif(UNIX)
            if(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64")
                set(_ort_platform "linux-aarch64")
            else()
                set(_ort_platform "linux-x64")
            endif()
        else()
            message(FATAL_ERROR "HKP_INFLECT_ENABLED: no prebuilt ONNX Runtime for this platform")
        endif()
        if(WIN32)
            set(_ort_archive "onnxruntime-${_ort_platform}-${HKP_INFLECT_ORT_VERSION}.zip")
        else()
            set(_ort_archive "onnxruntime-${_ort_platform}-${HKP_INFLECT_ORT_VERSION}.tgz")
        endif()
        FetchContent_Declare(onnxruntime
            URL "https://github.com/microsoft/onnxruntime/releases/download/v${HKP_INFLECT_ORT_VERSION}/${_ort_archive}"
            DOWNLOAD_EXTRACT_TIMESTAMP TRUE
        )
        # The archive carries no CMakeLists, so this only unpacks it.
        FetchContent_MakeAvailable(onnxruntime)
        set(_hkp_ort_root "${onnxruntime_SOURCE_DIR}")
        message(STATUS "hkp-rt-deps: inflect fetched onnxruntime ${HKP_INFLECT_ORT_VERSION}")
    endif()

    find_path(HKP_INFLECT_ORT_INCLUDE_DIR onnxruntime_cxx_api.h
              HINTS "${_hkp_ort_root}/include" NO_DEFAULT_PATH)
    find_library(HKP_INFLECT_ORT_LIBRARY NAMES onnxruntime
                 HINTS "${_hkp_ort_root}/lib" NO_DEFAULT_PATH)
    if(NOT HKP_INFLECT_ORT_INCLUDE_DIR OR NOT HKP_INFLECT_ORT_LIBRARY)
        message(FATAL_ERROR
            "HKP_INFLECT_ENABLED: onnxruntime headers or library not found under ${_hkp_ort_root}")
    endif()

    # ── the library ──────────────────────────────────────────────────────────
    # A separate static target rather than sources compiled straight into
    # hkp-rt-lib: espeak-ng exports src/include/compat on every consumer's
    # include path, and the stub wctype.h there shadows the system header and
    # breaks <string>/<regex>. Linking the archives by path takes the code
    # without those usage requirements, and keeping it to one target confines
    # the private include directory to the files that need it.
    add_library(hkp-inflect STATIC
        ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src/engine.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src/normalize.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src/num2words.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src/phonemize.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src/tokens.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src/utf8.cpp
    )
    target_include_directories(hkp-inflect
        PUBLIC  ${CMAKE_CURRENT_SOURCE_DIR}/inflect/include
        PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/inflect/src
                ${HKP_INFLECT_ORT_INCLUDE_DIR}
                ${espeak_ng_SOURCE_DIR}/src/include
    )
    target_link_libraries(hkp-inflect PUBLIC
        ${HKP_INFLECT_ORT_LIBRARY}
        $<TARGET_FILE:espeak-ng>
        $<TARGET_FILE:ucd>
    )
    # $<TARGET_FILE:> drops the build ordering that naming the target would carry.
    add_dependencies(hkp-inflect espeak-ng ucd)
    set_target_properties(hkp-inflect PROPERTIES POSITION_INDEPENDENT_CODE ON)
endif()

# nlohmann/json — declared before inja so inja reuses this version. Skipped when
# sherpa-onnx already created the target (see above) so the build shares one copy.
if(NOT TARGET nlohmann_json)
    CPMAddPackage(
        NAME nlohmann_json
        VERSION 3.11.3
        GIT_REPOSITORY "https://github.com/nlohmann/json"
        GIT_TAG v3.11.3
        OPTIONS "JSON_BuildTests OFF"
    )
endif()

# Inja template engine (header-only) — DOWNLOAD_ONLY skips its CMakeLists.txt
# which would otherwise try to export targets and fail with the nlohmann_json dep.
CPMAddPackage(
    NAME inja
    VERSION 3.4.0
    GIT_REPOSITORY "https://github.com/pantor/inja"
    GIT_TAG v3.4.0
    DOWNLOAD_ONLY TRUE
)

# minimp4 — single-header MP4/ISOBMFF demuxer used by the mp4-to-wav service.
# DOWNLOAD_ONLY: its CMakeLists only installs the header; we expose it ourselves.
CPMAddPackage(
    NAME minimp4
    GIT_REPOSITORY "https://github.com/lieff/minimp4.git"
    GIT_TAG        master
    DOWNLOAD_ONLY  TRUE
)

# jwt-cpp — header-only JWT verification (RS256 via OpenSSL) used by the runtime
# LAN auth layer. DOWNLOAD_ONLY: skip its CMakeLists (which exports targets and
# pulls picojson); we expose the include dir and use the nlohmann/json traits.
CPMAddPackage(
    NAME jwt-cpp
    VERSION 0.7.0
    GIT_REPOSITORY "https://github.com/Thalhammer/jwt-cpp"
    GIT_TAG v0.7.0
    DOWNLOAD_ONLY TRUE
)

# llama.cpp — in-process LLM inference for the text-generation service's local
# backend. Off for iOS/Android: those builds would pay the compile time and
# binary size, and the text-generation service still works there through its
# server backend, which needs no dependency at all.
if(IOS OR ANDROID)
    set(_HKP_LLAMA_DEFAULT OFF)
else()
    set(_HKP_LLAMA_DEFAULT ON)
endif()
option(HKP_LLAMA_ENABLED "Embed llama.cpp for the text-generation local backend" ${_HKP_LLAMA_DEFAULT})

if(HKP_LLAMA_ENABLED)
    CPMAddPackage(
        NAME llama_cpp
        GIT_REPOSITORY "https://github.com/ggml-org/llama.cpp"
        GIT_TAG b10069
        OPTIONS
            "LLAMA_BUILD_TESTS OFF"
            "LLAMA_BUILD_EXAMPLES OFF"
            "LLAMA_BUILD_SERVER OFF"
            "LLAMA_BUILD_TOOLS OFF"
            "LLAMA_BUILD_COMMON OFF"
            "LLAMA_CURL OFF"
            # Embed the Metal shaders in the binary so no .metal file has to sit
            # next to the runtime at load time.
            "GGML_METAL_EMBED_LIBRARY ON"
    )
endif()

# =============================================================================
# vcpkg — included AFTER CPM so its add_library wrapper doesn't interfere
# with packageProject ALIAS targets created by CPM-fetched packages.
# =============================================================================

include(${CMAKE_CURRENT_SOURCE_DIR}/vcpkg/scripts/buildsystems/vcpkg.cmake)

find_package(OpenSSL REQUIRED)
find_package(Boost 1.86 REQUIRED COMPONENTS
    date_time
    filesystem
    iostreams
    system
    thread
    url
    container
    json
)

# =============================================================================
# hkp-rt-deps — single INTERFACE target that all sub-projects link against
# =============================================================================
add_library(${PROJECT_NAME} INTERFACE)

# Vendored headers (crow.h, yas/, etc.)
target_include_directories(${PROJECT_NAME} INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})

target_link_libraries(${PROJECT_NAME} INTERFACE nlohmann_json::nlohmann_json)

if(inja_ADDED)
    target_include_directories(${PROJECT_NAME} INTERFACE ${inja_SOURCE_DIR}/include)
endif()

if(minimp4_ADDED)
    target_include_directories(${PROJECT_NAME} INTERFACE ${minimp4_SOURCE_DIR})
endif()

if(HKP_LLAMA_ENABLED AND TARGET llama)
    target_link_libraries(${PROJECT_NAME} INTERFACE llama)
    target_compile_definitions(${PROJECT_NAME} INTERFACE HKP_LLAMA_ENABLED)
    message(STATUS "hkp-rt-deps: text-generation local backend enabled (llama.cpp)")
else()
    message(STATUS "hkp-rt-deps: text-generation local backend disabled (server backend still available)")
endif()

if(HKP_SPEECH_ENABLED AND TARGET sherpa-onnx-c-api)
    target_link_libraries(${PROJECT_NAME} INTERFACE sherpa-onnx-c-api)
    target_compile_definitions(${PROJECT_NAME} INTERFACE HKP_SPEECH_ENABLED)
    message(STATUS "hkp-rt-deps: speech-to-text/text-to-speech local backends enabled (sherpa-onnx)")
else()
    message(STATUS "hkp-rt-deps: speech-to-text/text-to-speech local backends disabled (server backend still available)")
endif()

if(HKP_INFLECT_ENABLED AND TARGET hkp-inflect)
    target_link_libraries(${PROJECT_NAME} INTERFACE hkp-inflect)
    target_compile_definitions(${PROJECT_NAME} INTERFACE HKP_INFLECT_ENABLED)
    message(STATUS "hkp-rt-deps: text-to-speech inflect backend enabled")
else()
    message(STATUS "hkp-rt-deps: text-to-speech inflect backend disabled")
endif()

if(jwt-cpp_ADDED)
    target_include_directories(${PROJECT_NAME} INTERFACE ${jwt-cpp_SOURCE_DIR}/include)
    # Use nlohmann/json (already a dep) rather than the bundled picojson.
    target_compile_definitions(${PROJECT_NAME} INTERFACE JWT_DISABLE_PICOJSON)
endif()

target_link_libraries(${PROJECT_NAME} INTERFACE
    OpenSSL::SSL
    OpenSSL::Crypto
    Boost::date_time
    Boost::filesystem
    Boost::iostreams
    Boost::system
    Boost::thread
    Boost::url
    Boost::container
    Boost::json
)

# Apple system frameworks
if(APPLE)
    find_library(VIDEOTOOLBOX VideoToolbox REQUIRED)
    find_library(COREMEDIA    CoreMedia    REQUIRED)
    find_library(SECURITY     Security     REQUIRED)
    find_library(AVFOUNDATION AVFoundation REQUIRED)
    find_library(AUDIOTOOLBOX AudioToolbox REQUIRED)
    find_library(COREAUDIO    CoreAudio    REQUIRED)
    target_link_libraries(${PROJECT_NAME} INTERFACE
        ${VIDEOTOOLBOX} ${COREMEDIA} ${SECURITY}
        ${AVFOUNDATION} ${AUDIOTOOLBOX} ${COREAUDIO}
    )

    # Homebrew fallback for zstd/icu4c on universal or system builds
    if(NOT (CMAKE_OSX_ARCHITECTURES STREQUAL "x86_64" OR
            CMAKE_OSX_ARCHITECTURES STREQUAL "arm64"))
        find_program(HOMEBREW_EXECUTABLE brew)
        if(HOMEBREW_EXECUTABLE)
            execute_process(COMMAND ${HOMEBREW_EXECUTABLE} --prefix zstd
                OUTPUT_VARIABLE HOMEBREW_ZSTD_PREFIX OUTPUT_STRIP_TRAILING_WHITESPACE)
            execute_process(COMMAND ${HOMEBREW_EXECUTABLE} --prefix icu4c
                OUTPUT_VARIABLE HOMEBREW_ICU_PREFIX  OUTPUT_STRIP_TRAILING_WHITESPACE)
            target_link_directories(${PROJECT_NAME} INTERFACE
                ${HOMEBREW_ZSTD_PREFIX}/lib
                ${HOMEBREW_ICU_PREFIX}/lib
            )
        endif()
    endif()
endif()

# Windows system libraries
if(WIN32)
    target_link_libraries(${PROJECT_NAME} INTERFACE
        mfplat mf mfuuid mfreadwrite strmiids uuid secur32 vfw32 Shcore
    )
endif()
