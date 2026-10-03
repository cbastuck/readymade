# Assets

Content — a page, a script, an image, an audio sample, a model — declared once
in a board and named from service state by reference. Each runtime resolves a
reference when a service uses it, from wherever the content actually lives.

```json
"assets": [
  { "id": "player",  "mediaType": "text/html; charset=utf-8", "text": "<!doctype html>…" },
  { "id": "logo",    "mediaType": "image/png", "base64": "iVBOR…" },
  { "id": "whisper", "mediaType": "application/octet-stream",
    "url": "s3://models/whisper-small.bin", "sha256": "…", "size": 487000000 },
  { "id": "kit",     "mediaType": "audio/wav", "url": "file:///…/kit.wav" }
]

"body": "hkp-asset://player"
```

**State:** designed 2026-09-29; built 2026-09-30 except what *Work* lists as
remaining. How it works now is in `docs/content/concepts/assets.md`; this plan
keeps the decisions and what is still open. Prompted by
`boards/live-radio-cloud-demo-board.json`, where the player page (6 KB of HTML
and JS) sat inline in `radio.onRequest[0].state.template.body` — it is now the
assets `player` and `player-js`.

---

## The problem

Inline content works and keeps working. It stops working in three cases:

- **It is used twice.** Each use is a full copy, and changing it means finding
  every copy.
- **It is large.** A model or a sample library does not belong in a board
  document at all. It has to be named there and kept somewhere else.
- **It is not the service's concern.** The player page is the thing being
  served, not a setting of the service that serves it.

A block does not help. A block is a piece of a pipeline, and an asset is a value
that goes *into* a service.

---

## Decided

| Question | Decision | Why |
|---|---|---|
| Name | **Asset**; a place that names one is a **reference** | Free in the vocabulary. It is what the web calls the files a page is built from. |
| What the board holds | **Descriptors**: `id`, `mediaType`, exactly one source, and optionally `sha256` and `size` | Content may be too large for a board, or may exist only on one machine. See *Descriptors*. |
| What service state holds | **The reference, never the content**: `hkp-asset://<id>` as a whole field | `getState` echoes it and saving writes back what was configured. There is no round trip to undo. See *Rejected*. |
| Syntax | **A scheme**, not `{{…}}` | A reference names a whole value, the way `hkp-mount://` does, and is found by its scheme wherever it appears. Nothing is spliced into longer strings (see *Rejected*). |
| Who resolves | **The runtime that uses it**, at point of use, from a per-runtime **asset store** | A runtime fetches a URL source itself instead of having the content relayed through the browser. Editing an asset changes what is served without reconfiguring anything. |
| How descriptors reach a runtime | **Pushed**: in the create payload, on attach, **and again whenever an asset changes** | Propagation on change, which secrets deliberately do not have. For assets it is the point. |
| Which descriptors a runtime is given | **All of its document's**, unless an asset names the runtimes it is for (`runtimes`) — not the ones its services name (changed 2026-10-03) | Which asset a service uses can be decided while the board runs: the `asset` service takes one from its input, an endpoint resolves the body it is handed. A reference arriving from another runtime, a computed one, or one in a request was never in the scanned state, so it did not resolve. What is sent is the descriptor; large content is a URL. |
| Credentials | **None**: no `headers`, no `{{secret.…}}` in a descriptor (changed 2026-10-03) | An asset is resolved without anyone looking, on every runtime holding it — the least visible place a secret could be sent from, and a literal header would travel with every copy of the board. Content that needs a credential goes through `http-client` or a `file://` source. |
| Which services resolve | **The ones that consume content**, through one resolver. Everything else composes through the **`asset` service** | Only services that serve, play or load need to know. The `asset` service puts an asset into the pipeline for any other service. |
| An unresolved reference | **Fails loudly** | A service that does not resolve passes `hkp-asset://…` on as text, which is wrong visibly rather than quietly. This is the secrets argument. |
| `file://` | **Only the host that owns the path resolves it, and only inside a granted root** | Otherwise a shared board naming `file:///etc/passwd` behind an HTTP server is a leak. See *Sources*. |
| Units | **A runtime's store is filled from the document that contributed the runtime** | Each runtime belongs to exactly one document, so references are lexical without renaming anything. |
| Deploying | **Only the top-level board's descriptors travel today** | Its own runtimes receive those descriptors. A runtime contributed by a unit receives none of the unit's assets, so unit-owned references do not resolve after deployment. Uploading host-local content and carrying unit assets remain future work. |
| UI | **A third board view** beside the runtime view and the overview | Editing a page needs a code editor, and the view is also where *Used by* lives. See *The asset view*. |

---

## Descriptors

```ts
type AssetDescriptor = {
  id: string;
  name?: string;
  mediaType: string;
  sha256?: string;   // identity of the version: cache key and integrity check
  size?: number;     // for the view, and for refusing oversized inline content
} & (
  | { text: string }
  | { base64: string }
  | { url: string }
) & {
  runtimes?: string[];  // the runtimes given it; absent: every one of its document
};
```

Exactly one source per asset. A `url` is fetched as anyone would fetch it: a
descriptor takes no headers and names no secret (see *Decided*).

Inline sources (`text`, `base64`) are for content that is small and belongs to
the board. Anything else is a URL. The asset view may suggest moving inline
content out past a size threshold. It does not do so on its own, because where
the content goes is the author's call.

---

## Sources

| Scheme | Resolved by | Notes |
|---|---|---|
| `text`, `base64` | anyone | Already in the descriptor |
| `https://`, `http://` | the runtime using it | Fetched, cached by `sha256` (or ETag), and subject to the same limits as `http-client`: it is a request a board can make the server issue, which `http-client` already allows |
| `s3://` | the runtime using it | Through the same backend `storage` uses (`hkp-node/src/services/storage.ts`), so there is one S3 client, not two |
| `file://` | **only the host that owns the path**, inside a granted root | The native app, for its embedded hkp-rt and its browser runtime, inside a folder the user granted (e.g. `hkp://assets`). On hkp-node, a path resolves only inside the tenant's volume, as `filesystem` does. Anything outside a root is refused, never read. |

**Planned — host-local content for a remote runtime.** When a runtime cannot
resolve a source but the frontend can (a `file://` source on the native app, a
remote runtime on a server), the intended design is for the frontend to upload
it into that runtime's store, keyed by `sha256`. This is not built. Deployment
currently neither uploads such content nor refuses the deployment by asset
name.

---

## The model

### The store

Each runtime has an asset store. It is in memory for descriptors and on disk
for cached content, per (tenant, runtime), and it goes away with the runtime.

- `resolve(ref)` returns the content (bytes or a stream, with its `mediaType`),
  or a sentence saying why there is none: unknown id, source refused, fetch
  failed, hash mismatch.
- `subscribe(id, fn)` notifies a service when the asset changes. Only services
  that load once need it.
- Content is cached by `sha256` when a descriptor has one, and by source
  otherwise.

**Nesting delegates**, exactly as secrets do (`HostedRuntime.delegateSecrets`).
A nested runtime has no create payload of its own, so its store asks its host's
store, and a change pushed while the board runs is visible inside a pipeline
immediately. The two nesting implementations (`SubService`/`HostedRuntime` and
`NestedPipeline`) both need it. That is one more reason to consolidate them.

### The push

- **Create:** `POST /runtimes` carries an `assets` map beside `secrets`, holding
  every descriptor the runtime is given (`assetsOfRuntime`): its document's,
  less the ones whose `runtimes` leave it out. No scan decides it.
- **Attach:** the same map again, on `POST /runtimes/:id/assets`, which merges.
- **Change:** editing an asset in the view pushes the new descriptor to every
  runtime it is for, and its removal to the ones it is kept from. The store invalidates its cache for that id and
  notifies subscribers.
- **Attach:** re-push on `attachRuntime`, since a restarted runtime still has
  its services but has lost its store.
- The browser runtime's store *is* the board's `assets`, and needs no push.

### Consuming services

One resolver per runtime, shared by every service that consumes content. The
first consumers:

- **HTTP server responses.** A response envelope whose `body` is an
  `hkp-asset://` reference is resolved when the response is written: streamed,
  with `contentType` taken from the descriptor when `meta` names none. In the
  radio board, `template.body` becomes `hkp-asset://player`, and editing the
  asset changes what the next request gets. Nothing is reconfigured.
- **The `asset` service.** It emits an asset's content into the pipeline as
  `TextData` or `BinaryData`, with the media type in its metadata. This is how
  any service with no built-in support uses an asset, by composition. It is not
  meant for large content: a model does not belong in a pipeline frame.
- **Later**, services that load a file by path: model loaders
  (text-generation, speech), sample players. They take a reference where they
  take a path today, resolve it, and subscribe for changes.

### Saving

Nothing to do. Service state held references all along. The board's `assets`
are the frontend's own document and are written as they are. Blocks and units
are unaffected: a reference is just a string in state.

---

## The asset view

A third view, switched to the way the runtime view and the overview are
(`overview/OverviewToolbarButton.tsx` is the existing switch):

- **A list** of the board's assets: name, id, media type, source kind, size.
- **An editor** for inline text assets, with syntax highlighting by media type.
  **Apply** pushes the new descriptor. Changes are never pushed on each
  keystroke: a page served half-written is worse than a stale one. For URL
  sources, the view edits the descriptor and offers "fetch now" to check it
  resolves.
- **Used by**: every service whose state holds the reference, as service name,
  field path and a link that opens the service. It is found by a scan for the
  scheme, so it is always current.
- **New, rename, delete.** New can come from text, a dropped file (inline, or
  written into the granted folder on native) or a URL. Renaming rewrites every
  reference. Deleting one that is still referenced asks first.

**Make asset**, from a service panel, lifts a field's value into a new inline
asset and leaves the reference behind. This is only correct where the service
resolves that field, so it is offered only on fields a service declares as
accepting a reference. That declaration belongs with the service's
registration, not in the board (the secrets plan reaches the same conclusion).

---

## Rejected

### Substituting in the frontend, with write-back on save

This plan's first draft. The frontend filled references in while linking,
recorded each field's template, and on save wrote the template back wherever
the value still matched. It needed no runtime work, and any field of any
service could hold an asset. It failed on three counts:

- **Size.** The content lived in service state: it was sent with `configure`,
  held in the runtime and returned from every `getState`. A model could never
  be an asset.
- **Location.** The frontend had to be able to read every source and every
  runtime had to receive every value. A URL source would have been downloaded by
  the browser in order to be uploaded to the server that needed it.
- **The round trip.** Save-time comparison is the rule blocks gave up because
  of gaps it could not fix. Editing an asset meant reconfiguring every service
  that used it with a new copy, rather than the server serving the new version.

Secrets went through the same learning (`TODO-SECRETS.md` §1): once a value is
in state, the work is getting it back out.

### References inside longer strings

`"<script>{{asset.player-js}}</script>"`. This is only possible by
substitution, which is rejected above. The page loads `player.js` as a second
asset served by the same server instead, which is how the web does it anyway.

### Pushing every descriptor to every runtime

URL descriptors are tiny, but inline ones are not. Pushing only what a runtime
references matches secrets and keeps a runtime from holding content it has no
use for.

---

## Work

### Built (2026-09-30)

- **Board format, frontend.** `runtime/board/assets.ts` (descriptors, scheme,
  finding, renaming, *Used by*); `BoardDescriptor.assets`, held as board state
  beside the facade and carried through save, drafts, snapshots, share link,
  board source, templates and partner boards. A runtime's asset source is the
  document that contributed it (units).
- **Store and push.** hkp-node (`src/assets.ts`), hkp-python (`assets.py`) and
  hkp-rt (`assets.h`/`assets.cpp`): inline and `http(s)` sources, cache by
  `sha256`, ETag revalidation, subscriptions, `assets` in `POST /runtimes`,
  `POST /runtimes/:id/assets` (merge, `null` removes), a check route
  `GET /runtimes/:id/assets/:assetId`, nesting delegation. The frontend pushes
  at create, before a configure naming one, on attach, and on every edit
  (`core/assetActions.ts`). On deployment, the top-level board's descriptors
  travel to the coordinator and are provisioned to its own runtimes. A runtime
  contributed by a unit receives no unit-owned assets.
- **Consumers.** `http-server-subservices` resolves an asset body on all three
  servers; the `asset` service exists in the browser, hkp-node, hkp-python and
  hkp-rt, with a shared panel, tests, docs page and demo board. Both live-radio
  cloud boards serve their page and script as assets.
- **The asset view.** List, Monaco editor with Apply, URL descriptors with a
  per-runtime Check, *Used by* with a way to each service, new from text, file
  or URL, rename (rewrites references), delete (asks when referenced).
- **`file://`**: hkp-node inside the tenant's volumes (`file:///<volume>/<path>`),
  hkp-rt under `HKP_ASSET_ROOT`; refused everywhere else.
- **Docs.** `concepts/assets.md`, `services/asset.md`, `board-json.md`,
  `services/http.md`, the radio board pages, and `CLAUDE.md`.

### Remaining

- **Make asset** from a service panel. Blocked on *Which fields accept a
  reference* below.
- **`s3://`.** hkp-node's `storage` is a facade over a backend pipeline and has
  no S3 client of its own to share, so there is nothing to route through yet.
  Refused by name meanwhile.
- **Host-local content.** The native app's granted folder (`hkp://assets`) for
  its browser runtime, pointing its embedded hkp-rt's `HKP_ASSET_ROOT` there,
  uploading host-local content into a remote runtime's store keyed by
  `sha256`, and deploying with host-local assets (or refusing to, by name).
- **Model loaders** taking a reference where they take a path. They load by
  file path, so a resolved asset has to land in a file first — the on-disk
  cache the store section describes, which is not built (the stores cache in
  memory, bounded).
- **Unit assets in the view and flattened output.** A runtime a unit contributes
  resolves against the unit's assets locally, but the view lists and edits only
  the top-level board's own. A flattened export (deploy or share) carries only
  those top-level assets. Consequently, a coordinator gives a unit-contributed
  runtime no assets and its unit-owned references fail to resolve.
- **hkp-go**, when it has an HTTP server.

## Open

- **Where a dropped file goes on the web.** Native has a granted folder. The web
  keeps boards in local storage, which caps them at a few MB. An IndexedDB-backed
  source (`idb://`) would work in the browser but could not be resolved by any
  other runtime without an upload.
- **Which fields accept a reference.** A declaration on the service
  registration is the direction. The exact shape (field paths, or a marker in
  the service's state schema) is not settled.
- **Assets in the facade.** A `text` widget showing an asset, or an image. This
  is plausible, but it is a different reader (widgets, not services), so it gets
  its own decision.
- **Integrity for URL sources without `sha256`.** Trust what the URL returns
  each time, or pin the hash on first fetch and warn when it changes (the way
  secret audiences are learned)?
- **Mobile.** At least a read-only list with *Used by*.
- **Assets shared across boards.** Files in the granted folder already are,
  effectively. A library of named assets follows whatever blocks and presets
  settle on.
