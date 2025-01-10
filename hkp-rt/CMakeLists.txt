cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-rt VERSION 1.0 LANGUAGES CXX)

find_package(Boost 1.86 REQUIRED COMPONENTS
  date_time 
  filesystem 
  iostreams 
  system 
  thread
)

include_directories(3rdparty src)

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
  set(PLATFORM_SRC src/services/core_audio.cpp)
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
endif()

add_executable(hkp-rt 
  src/main.cpp 
  src/runtime.cpp 
  src/registry.cpp 
  src/service.cpp
  src/http/server.cpp
  src/types/models.cpp 
  src/types/data.cpp 
  src/types/ringbuffer.cpp
  src/common/socket_listener.cpp
  src/common/socket_session.cpp
  src/common/websocket.cpp
  ${PLATFORM_SRC}
)

set_property(TARGET hkp-rt PROPERTY CXX_STANDARD 20)

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  target_compile_definitions(hkp-rt PUBLIC "IS_LINUX")
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
  target_compile_definitions(hkp-rt PUBLIC "IS_MACOS")
  
  find_library(COREAUDIO CoreAudio)
  if (NOT COREAUDIO)
      message(FATAL_ERROR "CoreAudio not found")
  endif()

  #find_library(AUDIOTOOLBOX AudioToolbox)
  #if (NOT AUDIOTOOLBOX)
  #    message(FATAL_ERROR "AUDIOTOOLBOX not found")
  #endif()

  #find_library(COREFOUNDATION CoreFoundation)
  #if (NOT COREFOUNDATION)
  #    message(FATAL_ERROR "CoreFoundation not found")
  #endif()
  set(PLATFORM_LIBS ${COREAUDIO} ${AUDIOTOOLBOX})
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
  target_compile_definitions(hkp-rt PUBLIC "IS_WINDOWS")
  add_definitions(-D_WIN32_WINNT=0x0600)
endif()

target_link_libraries(hkp-rt 
  Boost::date_time 
  Boost::filesystem
  Boost::iostreams
  Boost::thread
  ${PLATFORM_LIBS}
)