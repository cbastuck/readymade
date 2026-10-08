# hkp-frontend

The **web target**: a standalone Vite + React app holding the board engine, the
browser runtime, and every browser service. It runs entirely in the browser —
boards live in local storage and no backend is required.

It is also the app the native shells embed, through `meander/frontend`.

Cloud board member links open on `https://readymadeit.com` by default. To test
against a locally running website, set `VITE_MEMBER_WEBAPP_ORIGIN` when starting
or building the app that creates the link. For a link copied from the native
Readymade app, start its frontend with:

```sh
cd meander/frontend
VITE_MEMBER_WEBAPP_ORIGIN=http://localhost:4000 npm run dev
```

Starting `hkp-website` with this variable only affects links copied from the
website itself. This changes only the member page's origin; the coordinator in
the link must still be reachable from that browser. Dropitapp's LAN links
continue to use `HKP_WEBAPP_URL`.

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
