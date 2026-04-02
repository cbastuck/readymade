cmake_minimum_required(VERSION 3.15...3.31)

if(NOT BUILD_TESTING)
  return()
endif()

find_package(Catch2 3 CONFIG QUIET)

if(NOT Catch2_FOUND)
  include(${CMAKE_CURRENT_LIST_DIR}/../../3rdparty/cmake/CPM.cmake)
  CPMAddPackage(
    NAME Catch2
    VERSION 3.6.0
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.6.0
  )

  list(APPEND CMAKE_MODULE_PATH ${Catch2_SOURCE_DIR}/extras)
endif()

include(Catch)

function(hkp_ad_hoc_sign_target target)
  if(APPLE)
    find_program(CODESIGN_EXECUTABLE codesign)
    if(CODESIGN_EXECUTABLE)
      add_custom_command(TARGET ${target} POST_BUILD
        COMMAND ${CODESIGN_EXECUTABLE} --force --sign - $<TARGET_FILE:${target}>
        VERBATIM)
    endif()
  endif()
endfunction()

add_executable(hkp-rt-runtime-tests
  runtime_validation.test.cpp
)
target_link_libraries(hkp-rt-runtime-tests PRIVATE hkp-rt-lib Catch2::Catch2WithMain)
target_compile_features(hkp-rt-runtime-tests PRIVATE cxx_std_20)
hkp_ad_hoc_sign_target(hkp-rt-runtime-tests)
catch_discover_tests(hkp-rt-runtime-tests)

add_executable(hkp-rt-service-tests
  service_base.test.cpp
  service_filter.test.cpp
  service_map.test.cpp
  service_static.test.cpp
  service_cache.test.cpp
)
target_include_directories(hkp-rt-service-tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../lib/src)
target_link_libraries(hkp-rt-service-tests PRIVATE hkp-rt-lib hkp-rt-deps Catch2::Catch2WithMain)
target_compile_features(hkp-rt-service-tests PRIVATE cxx_std_20)
hkp_ad_hoc_sign_target(hkp-rt-service-tests)
catch_discover_tests(hkp-rt-service-tests)
