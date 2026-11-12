# Building Readymade for the Web

The web target is **`hkp-frontend/`** — a standalone Vite + React app containing the board engine, the browser runtime, and all browser services. It runs entirely in the browser: boards live in local storage, and no backend is required.

This is the lightest way to work on Readymade. No CMake, vcpkg, or native toolchain is needed — see [README.md](./README.md) for the native desktop and mobile guides.

## Prerequisites

- Node.js + npm

## Run locally (dev server)

```bash
cd hkp-frontend
npm install
npm run dev
```

Vite serves on **http://localhost:5555** with hot reload (and on your LAN address via `--host` for testing on a phone).

`/` redirects to `/playground/<random-name>`. Other routes include `/remotes`, `/cloud-boards`, and `/profile`.

## Production build

```bash
cd hkp-frontend
npm run build
```

`tsc && vite build` writes a static bundle to **`hkp-frontend/build/`**. Serve that directory with any static file server configured to fall back to `index.html` for client-side routes.

To preview the production bundle locally:

```bash
npx vite preview --outDir build
```

## Connecting external runtimes

The browser runtime covers UI and general data-flow services. To use services on other runtimes (messaging, SQL, AI/ML, native audio), start the server you need and add it under **Remotes** in the app (boards reference servers by name, such as `"remote": "node"` or `"remote": "python"`):

- **Node.js (`hkp-node/`):** [hkp-node/README.md](./hkp-node/README.md)
- **Python (`hkp-python/`):** [hkp-python/README.md](./hkp-python/README.md)
- **C++ (`hkp-rt/`):** [hkp-rt/README-docker.md](./hkp-rt/README-docker.md)

## Notes

- **`hkp-website/` is optional:** It is the public website submodule (`readymadeit.com`), which embeds `hkp-frontend/src`. You do not need it to develop or run the web playground.
- **`/boards` in dev vs. production:** In dev mode, Vite serves `boards/*.json` at `/boards/…`. In production builds, demo boards referenced by the catalog are bundled directly.

## Tests

```bash
cd hkp-frontend
npm test
```
