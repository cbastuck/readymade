cmake_minimum_required(VERSION 3.21)
project(meander LANGUAGES CXX VERSION 1.0)

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

add_executable(
  ${PROJECT_NAME}
  backend/main.cpp
  backend/main.mm
  backend/schemeHandler.cpp
  backend/router.cpp
)

set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -g0" CACHE STRING "Release flags" FORCE)
set(CMAKE_C_FLAGS_RELEASE   "-O3 -DNDEBUG -g0" CACHE STRING "Release flags" FORCE)
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


# Use CMAKE_CURRENT_SOURCE_DIR so paths are correct whether built from root or standalone
set(APP_ICON "${CMAKE_CURRENT_SOURCE_DIR}/hkp.icns")
set_source_files_properties(${APP_ICON} PROPERTIES
    MACOSX_PACKAGE_LOCATION "Resources"
)
target_sources(${PROJECT_NAME} PRIVATE ${APP_ICON})
set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_ICON_FILE "hkp.icns"
    MACOSX_BUNDLE_GUI_IDENTIFIER "com.meander.app"
    MACOSX_BUNDLE_INFO_PLIST "${CMAKE_CURRENT_SOURCE_DIR}/macos/Info.plist"
)
set_target_properties(${PROJECT_NAME} PROPERTIES
    XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "com.meander.app"
)

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_23)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 23 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

# Build the frontend and embed it using saucer_embed
saucer_embed("frontend/dist" TARGET ${PROJECT_NAME})
target_compile_definitions(${PROJECT_NAME} PRIVATE USE_SAUCER_EMBEDDED)

if (APPLE)
  set(PLATFORM_LIBS )
else()
  set(PLATFORM_LIBS Crypt32)
endif()

target_link_libraries(
  ${PROJECT_NAME}
  PUBLIC
  saucer::saucer
  saucer::loop
  saucer::embedded
  hkp-rt-lib
  ${PLATFORM_LIBS}
)

if (COMPILE_USING_SAUCER_EMBEDDINGS)
  target_link_libraries(${PROJECT_NAME} PUBLIC saucer::embedded)
endif()
