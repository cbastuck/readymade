cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-rt-lib VERSION 1.0 LANGUAGES CXX)

option(BUILD_MAC_INTEL "Build for intel architecture on Apple Silicon" OFF)

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
  set (PLATFORM_SRC src/services/core_audio.cpp)
  
  # Check if CMAKE_OSX_ARCHITECTURES is already set by parent (e.g., via arch -x86_64)
  if(CMAKE_OSX_ARCHITECTURES)
    message("Using parent-specified architecture: ${CMAKE_OSX_ARCHITECTURES}")
  elseif (BUILD_MAC_INTEL)
    message("Building for Intel architecture on Apple Silicon")
    set(CMAKE_OSX_ARCHITECTURES "x86_64")
  else()
    message("Building for Apple Silicon")
    set(CMAKE_OSX_ARCHITECTURES "arm64")
  endif()
endif()

option(ENABLE_FFMPEG "Enable FFMPEG support" ON)

if (AVCPP_FOUND AND ENABLE_FFMPEG)
    set (PLATFORM_SRC ${PLATFORM_SRC} 
          src/services/ffmpeg/ffmpeg.cpp 
          src/services/ffmpeg/detail.cpp 
    )
    set (PLATFORM_DEFINES ${PLATFORM_DEFINES} "AVCPP_FOUND")

    add_subdirectory(hkp-bundles) # bundles depend on ffmpeg
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
endif()

add_library(${PROJECT_NAME} STATIC)
target_sources(${PROJECT_NAME}
    PRIVATE
      src/common/websocket_server_session.cpp
      src/runtime.cpp
      src/registry.cpp 
      src/service.cpp
      src/app.cpp
      src/http/server.cpp
      src/types/models.cpp 
      src/types/message.cpp
      src/types/data.cpp 
      src/types/ringbuffer.cpp
      src/common/websocket_server_listener.cpp      
      src/common/websocket_client_session.cpp
      #services
      src/common/inja.h
      src/common/websocket_server.cpp
      src/services/static.cpp
      src/services/http_client.cpp
      src/services/http_server/http_server.cpp
      src/services/http_server/http_server_impl.cpp
      src/services/http_server/http_listener.cpp
      src/services/http_server/http_session.cpp
      src/services/http_client.cpp
      src/services/websocket_writer.cpp
      src/services/writer_session.cpp
      src/services/filesystem.h
      src/services/map.h
      src/services/filter.h
      src/services/cache.h
      ${PLATFORM_SRC}
)

target_link_libraries(${PROJECT_NAME} hkp-rt-deps)
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_20)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 20 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  target_compile_definitions(${PROJECT_NAME} PUBLIC "IS_LINUX" ${PLATFORM_DEFINES} CROW_USE_BOOST=1)
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
  target_compile_definitions(${PROJECT_NAME} PUBLIC "IS_MACOS" ${PLATFORM_DEFINES} CROW_USE_BOOST=1)
  find_library(COREFOUNDATION_FRAMEWORK CoreFoundation REQUIRED)
  target_link_libraries(${PROJECT_NAME} ${COREFOUNDATION_FRAMEWORK})
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
  target_compile_definitions(${PROJECT_NAME} PUBLIC "IS_WINDOWS" ${PLATFORM_DEFINES} CROW_USE_BOOST=1)
  add_definitions(-D_WIN32_WINNT=0x0600)
  target_compile_options(${PROJECT_NAME} PRIVATE /bigobj)
endif()

target_include_directories(${PROJECT_NAME}
    PRIVATE
        # where the library itself will look for its internal headers
        ${CMAKE_CURRENT_SOURCE_DIR}/src
    PUBLIC
        # where top-level project will look for the library's public headers
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        # where external projects will look for the library's public headers
        $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)