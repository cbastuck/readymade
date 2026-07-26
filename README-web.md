# Building Readymade for the web

The web target is **`hkp-frontend/`** — a standalone Vite + React app containing the board
engine, the browser runtime, and all browser services. It runs entirely in the browser:
boards live in local storage, and no backend is required.

This is the lightest way to work on Readymade. There is no CMake, vcpkg, or native toolchain
involved — see [README.md](./README.md) for the platform guides that build the native shells.

## Prerequisites

- Node.js + npm

That's all.

## Run locally (dev server)

```bash
cd hkp-frontend
npm install
npm run dev
```

Vite serves on **http://localhost:5555** with hot reload. The dev script passes `--host`, so
the app is also reachable at your machine's LAN address — handy for opening a board on a phone
against the same live code.

`/` redirects to `/playground`, which redirects again to `/playground/<random-name>` — one
board per URL. Other routes: `/remotes` (browse a connected runtime), `/cloud-boards`,
`/profile`, and the auth callbacks.

## Production build

```bash
cd hkp-frontend
npm run build
```

`tsc && vite build` writes a static bundle to **`hkp-frontend/build/`** (`outDir` is set to
`build` in `vite.config.ts`, not the Vite default `dist`). Serve that directory with any static
file server. Because the app uses client-side routing, the server must fall back to
`index.html` for unknown paths, otherwise deep links like `/playground/foo` 404 on reload.

Quick local check of the built bundle:

```bash
npx vite preview --outDir build
```

## Connecting runtimes

The browser runtime alone covers most services. To use services that only exist on other
runtimes (messaging, AI/ML, audio), start the runtime you need and point the board's REST
runtime at it — `hkp-node/`, `hkp-python/`, and `hkp-rt/` each have their own README. Boards
may use `"HKP_RUNTIME_HOST"` as a URL placeholder when the host isn't known at design time.

## Do you need `hkp-website`?

**No.** `hkp-website/` is the public site (landing pages, the PHP endpoints under
`hkp-website/api/`, and its own `npm run deploy` sftp scripts). It *embeds* the app by aliasing
`hkp-frontend/src` in its `vite.config.ts` — the dependency runs website → frontend, never the
other way around. Running `hkp-frontend` on its own gives you the same playground the site
hosts.

Reach for `hkp-website` only when you're working on the public site itself. It is a git
submodule, so it needs `git submodule update --init` before it will build.

## Note on `/boards`

In dev, a small Vite middleware serves `hkp-frontend/boards/*.json` over HTTP at `/boards/…`.
The production build does **not** copy that directory into the output. Demo boards the UI
loads directly are imported as modules and get bundled normally, so this only matters if you
link to board JSON by URL.

## Tests

```bash
cd hkp-frontend
npm install
npm test
```
