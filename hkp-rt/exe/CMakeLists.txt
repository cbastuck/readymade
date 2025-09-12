cmake_minimum_required(VERSION 3.15...3.31)
project(hkp-rt VERSION 1.0 LANGUAGES CXX)

add_executable(${PROJECT_NAME} main.cpp)

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_20)
set_target_properties(${PROJECT_NAME} PROPERTIES CXX_STANDARD 20 CXX_EXTENSIONS OFF CXX_STANDARD_REQUIRED ON)

if (MSVC)
    add_compile_options(-D_WIN32_WINNT=0x0601)
    target_link_libraries(${PROJECT_NAME} hkp-rt-lib Crypt32)
else()
    # TODO: core foundation needed as CoreInput service uses CFRelease
    target_link_libraries(${PROJECT_NAME} hkp-rt-lib "-framework CoreFoundation")
endif()