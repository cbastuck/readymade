# Download pre-build boost

- https://github.com/MarkusJx/prebuilt-boost/releases/download/1.86.0/boost-1.86.0-windows-2022-msvc-static-x86.tar.gz

# Run cmake

- BOOST_ROOT=/C/Users/cbastuck/Development/Projects/hookup/hkp-rt/3rdparty/boost cmake ..

# Compile sources

- cmake --build . --config Release --target ALL_BUILD

# Compile for Intel architecture on Apple Silicon

- cmake -DBUILD_MAC_INTEL=ON ..

# Docker images on AWS ECR (elastic container registry)

## Login

- aws ecr get-login-password --profile hkp-ecr-access --region eu-central-1 | docker login --username AWS --password-stdin 179442056116.dkr.ecr.eu-central-1.amazonaws.com

## Build and push base image for building hkp-rt for linux

- docker build --platform linux/amd64 -f Dockerfile.linux -t hkp/rt-base .

- docker tag hkp/rt-base:latest 179442056116.dkr.ecr.eu-central-1.amazonaws.com/hkp/rt-base:latest

- docker push 179442056116.dkr.ecr.eu-central-1.amazonaws.com/hkp/rt-base:latest

## Run the docker image

- docker run -ti --rm hkp/rt-base /bin/bash
