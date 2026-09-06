cmake_minimum_required(VERSION 3.15...3.31)

# Standalone on purpose: these tests cover rules the app backend keeps apart
# from its saucer-facing code, so they build without saucer, vcpkg or the
# runtime library. That is what makes them runnable in seconds from
# meander/run-tests.sh rather than only as part of a full app build.
project(readymade-backend-tests CXX)

include(CTest)

find_package(Catch2 3 CONFIG QUIET)

if(NOT Catch2_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.6.0
  )
  FetchContent_MakeAvailable(Catch2)
  list(APPEND CMAKE_MODULE_PATH ${catch2_SOURCE_DIR}/extras)
endif()

find_package(nlohmann_json 3 CONFIG QUIET)

if(NOT nlohmann_json_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
  )
  FetchContent_MakeAvailable(nlohmann_json)
endif()

include(Catch)

add_executable(readymade-backend-tests
  remoteRoute.test.cpp
  vault.test.cpp
  grants.test.cpp
)
target_include_directories(readymade-backend-tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/..)
target_link_libraries(readymade-backend-tests PRIVATE Catch2::Catch2WithMain nlohmann_json::nlohmann_json)
target_compile_features(readymade-backend-tests PRIVATE cxx_std_20)

if(APPLE)
  find_program(CODESIGN_EXECUTABLE codesign)
  if(CODESIGN_EXECUTABLE)
    add_custom_command(TARGET readymade-backend-tests POST_BUILD
      COMMAND ${CODESIGN_EXECUTABLE} --force --sign - $<TARGET_FILE:readymade-backend-tests>
      VERBATIM)
  endif()
endif()

catch_discover_tests(readymade-backend-tests)
