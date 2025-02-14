cmake_minimum_required(VERSION 3.21)
project(hkp-saucer LANGUAGES CXX VERSION 1.0)

include(cmake/CPM.cmake)

add_custom_target(run ALL
  COMMAND npm run build-hkp-saucer
)

#CPMAddPackage("gh:fmtlib/fmt#7.1.3")
#CPMAddPackage("gh:nlohmann/json@3.10.5")
#CPMAddPackage("gh:catchorg/Catch2@3.4.0")
CPMAddPackage(
  NAME           saucer
  VERSION        6.0.1
  GIT_REPOSITORY "https://github.com/saucer/saucer"
)

add_executable(${PROJECT_NAME} "backend/main.cpp")

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_23)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 23 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

target_include_directories(${PROJECT_NAME} PRIVATE "frontend/embedded")

#target_link_libraries(main fmt::fmt nlohmann_json::nlohmann_json Catch2::Catch2WithMain)
target_link_libraries(${PROJECT_NAME} PUBLIC saucer::saucer)
