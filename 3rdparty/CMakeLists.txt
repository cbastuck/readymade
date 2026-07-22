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
