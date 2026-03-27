cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-rt-bundle VERSION 1.0 LANGUAGES CXX)


set (SOURCES ../src/services/ffmpeg/ffmpeg.cpp 
              ../src/services/ffmpeg/detail.cpp
              plugin_register.cpp)

add_library(${PROJECT_NAME} SHARED ${SOURCES})
target_link_libraries(${PROJECT_NAME} hkp-rt-deps hkp-rt-lib)
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_20)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 20 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  target_compile_definitions(${PROJECT_NAME} PUBLIC "IS_LINUX" ${PLATFORM_DEFINES} CROW_USE_BOOST=1)
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
  target_compile_definitions(${PROJECT_NAME} PUBLIC "IS_MACOS" ${PLATFORM_DEFINES} CROW_USE_BOOST=1)
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
  target_compile_definitions(${PROJECT_NAME} PUBLIC "IS_WINDOWS" ${PLATFORM_DEFINES} CROW_USE_BOOST=1)
  add_definitions(-D_WIN32_WINNT=0x0600)
  target_compile_options(${PROJECT_NAME} PRIVATE /bigobj)
endif()

target_include_directories(${PROJECT_NAME}
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/../src
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/../include>
        $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)

# Add explicit code signing on macOS
if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND codesign --force --sign - $<TARGET_FILE:${PROJECT_NAME}>
        COMMENT "Code signing ${PROJECT_NAME}"
        VERBATIM
    )
endif()

# Custom build rule to copy the bundle to ~/.hkp/bundles
# This runs after code signing due to command order
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E echo "Copying bundle to ~/.hkp/bundles"
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.hkp/bundles"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_FILE:${PROJECT_NAME}>
        "$ENV{HOME}/.hkp/bundles/$<TARGET_FILE_NAME:${PROJECT_NAME}>"
    COMMENT "Copying ${PROJECT_NAME} bundle to ~/.hkp/bundles"
    VERBATIM
)