cmake_minimum_required(VERSION 3.21)
project(hkp LANGUAGES CXX VERSION 1.0)

if(APPLE)
	enable_language(OBJCXX)
endif()

# Keep MSVC CRT linkage aligned with the selected vcpkg triplet.
# - *-static triplets use /MT (/MTd)
# - non-static triplets use /MD (/MDd)
if(MSVC)
	if(DEFINED VCPKG_TARGET_TRIPLET AND VCPKG_TARGET_TRIPLET MATCHES "-static")
		set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
	else()
		set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
	endif()
endif()

include(${CMAKE_CURRENT_SOURCE_DIR}/3rdparty/cmake/CPM.cmake)

# Saucer must be fetched before 3rdparty/vcpkg.cmake is included to avoid
# alias-target conflicts in upstream packageProject() exports on Windows.
# TODO: move this back to 3rdparty while preserving the property mentioned above
option(BUILD_HKP_SAUCER "Build the hkp-saucer GUI application" ON)
if(BUILD_HKP_SAUCER)
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
	CPMAddPackage(
		NAME      saucer-desktop
		VERSION   4.1.0
		GIT_REPOSITORY "https://github.com/saucer/desktop"
	)
endif()

add_subdirectory(3rdparty)
add_subdirectory(hkp-rt)
add_subdirectory(meander)
