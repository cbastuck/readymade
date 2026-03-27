cmake_minimum_required(VERSION 3.21)
project(hkp LANGUAGES CXX OBJCXX VERSION 1.0)

# =============================================================================
# CPM — kept only for dependencies not available in vcpkg (saucer, inja)
# =============================================================================
include(hkp-rt/3rdparty/cmake/CPM.cmake)

# Inja template engine (header-only)
CPMAddPackage(
    NAME inja
    VERSION 3.4.0
    GIT_REPOSITORY "https://github.com/pantor/inja"
    GIT_TAG v3.4.0
)

# Saucer GUI framework (custom fork, not in vcpkg)
option(BUILD_HKP_SAUCER "Build the hkp-saucer GUI application" ON)
if(BUILD_HKP_SAUCER)
    CPMAddPackage(
        NAME      saucer
        VERSION   6.0.5
        GIT_REPOSITORY "https://github.com/cbastuck/saucer"
        OPTIONS  "saucer_prefer_remote ON"
    )
endif()

# =============================================================================
# vcpkg dependencies
# =============================================================================
if(NOT DEFINED CMAKE_TOOLCHAIN_FILE)
    message(WARNING
        "CMAKE_TOOLCHAIN_FILE is not set. "
        "Pass -DCMAKE_TOOLCHAIN_FILE=hkp-rt/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake")
endif()

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
add_library(hkp-rt-deps INTERFACE)

# Vendored headers (crow.h, nlohmann/, yas/, etc.)
target_include_directories(hkp-rt-deps INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}/hkp-rt/3rdparty
)

target_link_libraries(hkp-rt-deps INTERFACE
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

if(inja_ADDED)
    target_include_directories(hkp-rt-deps INTERFACE ${inja_SOURCE_DIR}/include)
endif()

# avcpp / FFmpeg (optional — requires the avcpp git submodule)
option(ENABLE_FFMPEG "Enable FFmpeg support via avcpp" ON)
if(ENABLE_FFMPEG AND EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/hkp-rt/3rdparty/avcpp/CMakeLists.txt)
    find_package(ffmpeg REQUIRED)
    target_include_directories(hkp-rt-deps INTERFACE ${FFMPEG_INCLUDE_DIRS})
    target_link_directories(hkp-rt-deps INTERFACE ${FFMPEG_LIBRARY_DIRS})
    target_link_libraries(hkp-rt-deps INTERFACE ${FFMPEG_LIBRARIES})
    add_subdirectory(hkp-rt/3rdparty/avcpp)
    target_link_libraries(hkp-rt-deps INTERFACE avcpp-static)
    set(AVCPP_FOUND true)
endif()

# Apple system frameworks
if(APPLE)
    find_library(VIDEOTOOLBOX VideoToolbox REQUIRED)
    find_library(COREMEDIA    CoreMedia    REQUIRED)
    find_library(SECURITY     Security     REQUIRED)
    find_library(AVFOUNDATION AVFoundation REQUIRED)
    find_library(AUDIOTOOLBOX AudioToolbox REQUIRED)
    find_library(COREAUDIO    CoreAudio    REQUIRED)
    target_link_libraries(hkp-rt-deps INTERFACE
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
            target_link_directories(hkp-rt-deps INTERFACE
                ${HOMEBREW_ZSTD_PREFIX}/lib
                ${HOMEBREW_ICU_PREFIX}/lib
            )
        endif()
    endif()
endif()

# Windows system libraries
if(WIN32)
    target_link_libraries(hkp-rt-deps INTERFACE
        mfplat mf mfuuid mfreadwrite strmiids uuid secur32 vfw32 Shcore
    )
endif()

# =============================================================================
# Sub-projects
# =============================================================================
add_subdirectory(hkp-rt)

if(BUILD_HKP_SAUCER)
    add_subdirectory(hkp-saucer)
endif()
