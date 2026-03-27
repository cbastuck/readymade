cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-cpp VERSION 1.0 LANGUAGES CXX)

# When built standalone (not via the root CMakeLists.txt), bootstrap dependencies
# from the 3rdparty directory.  When built from root, hkp-rt-deps is already
# defined there and 3rdparty is skipped.
if(NOT TARGET hkp-rt-deps)
    add_subdirectory(3rdparty)
endif()

add_subdirectory(lib)
add_subdirectory(exe)
