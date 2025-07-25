cmake_minimum_required(VERSION 3.21)
project(hkp-saucer LANGUAGES CXX VERSION 1.0)

include(cmake/CPM.cmake)

# Custom target to run npm build and generate backend/embedded/all.hpp
option(COMILE_USING_SAUCER_EMBEDDINGS "Build and use embedded webapp" )
if (COMILE_USING_SAUCER_EMBEDDINGS)
  add_custom_target(run ALL
    COMMAND npm run build-hkp-saucer
    BYPRODUCTS ${CMAKE_CURRENT_SOURCE_DIR}/backend/embedded/all.hpp
    COMMENT "Running npm build-hkp-saucer to generate backend/embedded/all.hpp"
  )
  SET(EMBEDDED_SOURCES, "backend/embedded/all.hpp")
  target_compile_definitions(${PROJECT_NAME} PRIVATE USE_SAUCER_EMBEDDED)
endif()


#CPMAddPackage("gh:fmtlib/fmt#7.1.3")
#CPMAddPackage("gh:nlohmann/json@3.10.5")
#CPMAddPackage("gh:catchorg/Catch2@3.4.0")

#set(CMAKE_OSX_ARCHITECTURES "x86_64;arm64") # optional for universal builds

CPMAddPackage(
  NAME      saucer
  VERSION   6.0.2
  GIT_REPOSITORY "https://github.com/cbastuck/saucer"
)

CPMFindPackage(
  NAME           saucer-desktop
  VERSION        2.0.0
  GIT_REPOSITORY "https://github.com/saucer/desktop"
)

add_executable(
  ${PROJECT_NAME}
  backend/main.cpp
  backend/schemeHandler.cpp
  backend/router.cpp
  ${EMBEDDED_SOURCES}
)


set(APP_ICON "${CMAKE_SOURCE_DIR}/hkp-saucer/hkp.icns")
set_source_files_properties(${APP_ICON} PROPERTIES
    MACOSX_PACKAGE_LOCATION "Resources"
)
target_sources(${PROJECT_NAME} PRIVATE ${APP_ICON})
set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_ICON_FILE "hkp.icns"
    MACOSX_BUNDLE_GUI_IDENTIFIER "com.hookitapp.hkp-saucer"
    MACOSX_BUNDLE_INFO_PLIST "${CMAKE_SOURCE_DIR}/hkp-saucer/macos/Info.plist"
)

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_23)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 23 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

if (COMILE_USING_SAUCER_EMBEDDINGS)
  target_include_directories(${PROJECT_NAME} PRIVATE "frontend/embedded")
endif()

#target_link_libraries(main fmt::fmt nlohmann_json::nlohmann_json Catch2::Catch2WithMain)
target_link_libraries(${PROJECT_NAME} PUBLIC saucer::desktop hkp-rt-lib)
