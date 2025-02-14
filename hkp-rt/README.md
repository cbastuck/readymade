# Download pre-build boost

- https://github.com/MarkusJx/prebuilt-boost/releases/download/1.86.0/boost-1.86.0-windows-2022-msvc-static-x86.tar.gz

# Run cmake

- BOOST_ROOT=/C/Users/cbastuck/Development/Projects/hookup/hkp-rt/3rdparty/boost cmake ..

# Compile sources

- cmake --build . --config Release --target ALL_BUILD

# Compile for Intel architecture on Apple Silicon

- cmake -DBUILD_MAC_INTEL=ON ..
