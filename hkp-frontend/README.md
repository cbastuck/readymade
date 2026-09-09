# hkp-frontend

The **web target**: a standalone Vite + React app holding the board engine, the
browser runtime, and every browser service. It runs entirely in the browser —
boards live in local storage and no backend is required.

It is also the app the native shells embed, through `meander/frontend`.

## Running it

```sh
npm install
npm run dev      # Vite on http://localhost:5555, with --host for LAN access
npm test         # vitest
```

`README-web.md` at the repository root is the full guide: routes, the production
build, and what the target does and does not include. `docs/content/` holds the
documentation the website serves — start at `targets.md` for how this target
relates to the desktop and mobile ones.
