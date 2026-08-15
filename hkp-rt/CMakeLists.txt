cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-cpp VERSION 1.0 LANGUAGES CXX)

include(CTest)

# Whether to build this project's test suites, captured before the dependencies
# are added: some of them write BUILD_TESTING back to the cache (sherpa-onnx's
# eigen.cmake forces it OFF), so by the time the tests directory would be added
# that flag no longer says what this build was asked for. Nothing outside this
# project writes this option.
option(HKP_RT_BUILD_TESTS "Build the hkp-rt test suites" ${BUILD_TESTING})

# include(CTest) enables testing only while BUILD_TESTING is still ON, so a
# build dir whose cached flag was overwritten needs it enabled from our option
# instead — without it the tests build but CTest never learns about them.
if(HKP_RT_BUILD_TESTS)
    enable_testing()
endif()

# When built standalone (not via the root CMakeLists.txt), bootstrap dependencies
# from the 3rdparty directory.  When built from root, hkp-rt-deps is already
# defined there and 3rdparty is skipped.
if(NOT TARGET hkp-rt-deps)
    add_subdirectory(../3rdparty 3rdparty)
endif()

add_subdirectory(lib)

# The server executable and tests are host-only; skip them for iOS device builds.
if(NOT IOS)
    add_subdirectory(exe)
    if(HKP_RT_BUILD_TESTS)
        add_subdirectory(tests)
    endif()
endif()
