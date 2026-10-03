# Building & running the hkp-rt Docker image

hkp-rt is the C++ runtime server. The image is built from the
[`Dockerfile`](Dockerfile) in this directory: multi-stage on `ubuntu:24.04`, runs as
the unprivileged `hkp` user, and binds `HOST=0.0.0.0` so published ports reach the
process.

There is no published image and no CI workflow for it yet. This describes building
and running it yourself.

---

## Build

**From the repository root, not from `hkp-rt/`.** The build needs `3rdparty/`, which
sits beside this directory, and Docker cannot copy from outside its build context:

```sh
cd <repository root>
docker build -f hkp-rt/Dockerfile -t hkp-rt .
```

Running `docker build .` inside `hkp-rt/` fails with
`"/hkp-rt/exe" not found` — that is this mistake.

The first build takes about nine minutes: vcpkg compiles Boost and OpenSSL from
source inside the image. Later builds reuse those layers unless `3rdparty/` changes.

[`Dockerfile.dockerignore`](Dockerfile.dockerignore) keeps the context to what the
build uses; the repository holds gigabytes it has no use for. It needs BuildKit,
which current Docker uses by default (`DOCKER_BUILDKIT=1` forces it on older ones).

The image is built for the architecture of the machine building it. For another:

```sh
docker build --platform linux/amd64 -f hkp-rt/Dockerfile -t hkp-rt .
```

### What is left out

The in-process ML backends — llama.cpp, the sherpa-onnx speech models, inflect — are
not in the image. They multiply its size, and inference runs better beside a
container than inside it. `text-generation`, `speech-to-text` and `text-to-speech`
are in its registry all the same and reach an OpenAI-compatible server by URL, which
is how a board in this image uses a sidecar. Asking one of them for its embedded
backend answers with an error naming it.

The macOS audio services (`core-input`, `core-output`) are absent, as on any Linux
build.

---

## Run

A container is reached from outside, so it has to be told who may use it. Without
all three of `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` and `ALLOWED_EMAILS` it **refuses to
start**, naming what is missing, rather than serve an open port:

```sh
docker run --rm \
  -p 8887:8887 \
  -v hkp-rt-data:/home/hkp/.hkp \
  -e AUTH0_DOMAIN=<tenant>.eu.auth0.com \
  -e AUTH0_AUDIENCE=<client id> \
  -e ALLOWED_EMAILS=me@example.com \
  hkp-rt
```

| Variable | Default in the image | |
|---|---|---|
| `HOST` | `0.0.0.0` | The interface listened on, inside the container. Which of the host's it is published on is the `-p` |
| `PORT` | `8887` | |
| `AUTH0_DOMAIN` | — | The Auth0 tenant whose tokens are accepted |
| `AUTH0_AUDIENCE` | — | Accepted `aud` values, comma-separated |
| `ALLOWED_EMAILS` | — | Who may use the server, comma-separated. Matched against the verified `email` claim |
| `ALLOWED_ORIGINS` | `*` | Browser origins allowed to call it |
| `HKP_EXTERNAL_URL` | — | Where the server is reached from outside when that is not `http://<host>:<port>` — behind a proxy that terminates TLS. Endpoints its services expose are published under it |
| `EXTERNAL_HOST` | `127.0.0.1` | The host it says it is reached at, when `HKP_EXTERNAL_URL` is not set |
| `HKP_MOUNT_SECRET` | — | Keys the addresses of its endpoints. Unset, one is drawn and kept in the volume |
| `HKP_COORDINATOR_LINKS_FILE` | `~/.hkp/cpp/coordinator-links.json` | Where coordinator tickets are kept. Empty keeps them in memory only |

### The volume

`/home/hkp/.hkp` holds the two things that must survive a restart:

- `cpp/coordinator-links.json` — the tickets this server reconnects to coordinators
  with. Without it, a deployed board's runtime here is gone after a restart until
  the board is deployed again.
- `cpp/mount-secret` — what its endpoints' addresses are derived from. Without it,
  every endpoint gets a new address on each start.

Both are written readable by their owner only.

### One port

Everything is on the one published port: the REST api, a runtime's notification
socket, and any endpoint a service exposes (`/hosted/<id>`). Behind a reverse proxy,
forward that port and set `HKP_EXTERNAL_URL` to the public address:

```sh
  -e HKP_EXTERNAL_URL=https://rt.example.com
```

### Stopping

`docker stop` sends `SIGTERM`, on which the server closes its coordinator links and
exits. A coordinator then sees the runtime leave rather than timing it out.

### Loopback only, for trying it out

Published on the host's loopback interface the port is not reachable from elsewhere,
but the server inside still listens on `0.0.0.0` and so still wants the three auth
variables. To run with no auth at all, make it listen on loopback inside the
container too and share the host's network (Linux only):

```sh
docker run --rm --network host -e HOST=127.0.0.1 hkp-rt
```

---

## Using it

Add the server to a client's runtime servers under a name, and a board can place a
runtime on it with `"remote": "<that name>"`. It can take part in a deployed board:
see `docs/content/concepts/remotes.md`, and `docs/content/targets.md` for the
standalone server in general.
