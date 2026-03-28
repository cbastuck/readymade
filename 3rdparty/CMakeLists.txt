cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-rt-deps VERSION 1.0 LANGUAGES CXX)

include(cmake/CPM.cmake)

# =============================================================================
# CPM packages — must all be fetched BEFORE vcpkg is included so that
# packageProject() ALIAS targets are created before vcpkg wraps add_library.
# =============================================================================

# nlohmann/json — declared before inja so inja reuses this version
CPMAddPackage(
    NAME nlohmann_json
    VERSION 3.11.3
    GIT_REPOSITORY "https://github.com/nlohmann/json"
    GIT_TAG v3.11.3
    OPTIONS "JSON_BuildTests OFF"
)

# Inja template engine (header-only) — DOWNLOAD_ONLY skips its CMakeLists.txt
# which would otherwise try to export targets and fail with the nlohmann_json dep.
CPMAddPackage(
    NAME inja
    VERSION 3.4.0
    GIT_REPOSITORY "https://github.com/pantor/inja"
    GIT_TAG v3.4.0
    DOWNLOAD_ONLY TRUE
)

# Saucer GUI framework + event loop module
option(BUILD_HKP_SAUCER "Build the hkp-saucer GUI application" ON)
if(BUILD_HKP_SAUCER)
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
