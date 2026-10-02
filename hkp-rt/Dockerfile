# hkp-rt, the C++ runtime server, as a container.
#
# Built from the repository root, because the build needs 3rdparty/ beside
# hkp-rt/:
#
#   docker build -f hkp-rt/Dockerfile -t hkp-rt .
#
# What the image carries is the runtime server and the services that need no
# machine of their own. The in-process ML backends — llama.cpp, the sherpa-onnx
# speech models, inflect — are left out: they multiply the image's size, and
# inference runs better beside the container than inside it. The services they
# belong to (text-generation, speech-to-text, text-to-speech) are in the
# registry all the same and reach an OpenAI-compatible server by URL, which is
# how a board in this image uses a sidecar.
#
# Run it with who may use it, since a container is reached from outside:
#
#   docker run -p 8887:8887 -v hkp-rt-data:/home/hkp/.hkp \
#     -e AUTH0_DOMAIN=tenant.eu.auth0.com \
#     -e AUTH0_AUDIENCE=<client id> \
#     -e ALLOWED_EMAILS=me@example.com \
#     -e HKP_EXTERNAL_URL=https://rt.example.com \
#     hkp-rt
#
# Without those three it refuses to start rather than serve an open port. The
# volume holds what must survive a restart: the tickets it reconnects to
# coordinators with, and the secret its endpoints' addresses are derived from.

# ── Build ────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04 AS build

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential ca-certificates cmake curl git nasm ninja-build \
      pkg-config tar unzip zip linux-libc-dev python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# vcpkg at the commit the repository pins (3rdparty/vcpkg.json's baseline), so
# the image is built from the dependencies everything else is tested with.
ARG VCPKG_COMMIT=bba8b52f6dea74159bba855ef00376e588d6ea0a
COPY 3rdparty/ 3rdparty/
RUN git clone https://github.com/microsoft/vcpkg.git 3rdparty/vcpkg \
    && git -C 3rdparty/vcpkg checkout ${VCPKG_COMMIT} \
    && 3rdparty/vcpkg/bootstrap-vcpkg.sh -disableMetrics

COPY hkp-rt/CMakeLists.txt hkp-rt/CMakeLists.txt
COPY hkp-rt/lib/ hkp-rt/lib/
COPY hkp-rt/exe/ hkp-rt/exe/

# The triplet follows the machine the image is built for.
RUN case "$(uname -m)" in \
      aarch64) triplet=arm64-linux-release ;; \
      *)       triplet=x64-linux-release ;; \
    esac \
    && cmake -S hkp-rt -B /build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_TOOLCHAIN_FILE=/src/3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake \
      -DVCPKG_MANIFEST_DIR=/src/3rdparty \
      -DVCPKG_TARGET_TRIPLET=${triplet} \
      -DVCPKG_OVERLAY_TRIPLETS=/src/3rdparty/vcpkg-triplets \
      -DBUILD_TESTING=OFF \
      -DHKP_RT_BUILD_TESTS=OFF \
      -DHKP_LLAMA_ENABLED=OFF \
      -DHKP_SPEECH_ENABLED=OFF \
      -DHKP_INFLECT_ENABLED=OFF \
      -DBUILD_HKP_SAUCER=OFF \
    && cmake --build /build --target hkp-rt

# ── Run ──────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 hkp \
    && mkdir -p /home/hkp/.hkp \
    && chown -R hkp:hkp /home/hkp/.hkp

COPY --from=build /build/exe/hkp-rt /usr/local/bin/hkp-rt

USER hkp
WORKDIR /home/hkp

# Listens on every interface of the container; which of the host's it is
# published on is the `-p` of whoever runs it.
ENV HOST=0.0.0.0 \
    PORT=8887 \
    HOME=/home/hkp

VOLUME ["/home/hkp/.hkp"]
EXPOSE 8887

# SIGTERM closes its coordinator links before it exits.
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/hkp-rt"]
