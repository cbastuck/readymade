# Assets

Content — a page, a script, an image, an audio sample — declared once in a board and named from service state by reference. Each runtime resolves a reference when a service uses it, from wherever the content actually lives.

---

## The problem

Inline content works, and keeps working, until one of three things is true:

- **It is used twice.** Each use is a full copy, and changing it means finding
  every copy.
- **It is large.** A sample library or a model does not belong in a board
  document. It has to be named there and kept somewhere else.
- **It is not the service's concern.** A page an endpoint serves is the thing
  being served, not a setting of the service that serves it — and as a string in
  that service's state it can only be edited as one line of escaped JSON.

A [block](./blocks.md) does not help: a block is a piece of a pipeline, and an
asset is a value that goes *into* a service.

---

## What an asset is

A board declares its assets beside its runtimes and services, as **descriptors**:
an id, a media type and exactly one source.

```json
"assets": [
  { "id": "player",    "mediaType": "text/html; charset=utf-8", "text": "<!doctype html>…" },
  { "id": "logo",      "mediaType": "image/png", "base64": "iVBOR…" },
  { "id": "whisper",   "mediaType": "application/octet-stream",
    "url": "https://models.example.com/whisper-small.bin", "sha256": "…", "size": 487000000 }
]
```

| Field | |
|---|---|
| `id` | **required.** What references use: letters, digits, `.`, `-` and `_` |
| `mediaType` | **required.** What the content is; a served asset is sent with it |
| `text` \| `base64` \| `url` | **exactly one.** The content, or where it lives |
| `headers` | for a `url`: request headers, which may name `{{secret.…}}` |
| `sha256` | the version: an integrity check, and what lets a runtime cache a URL without asking again |
| `size` | for the view, and for refusing oversized content |
| `name` | what a person calls it |

Service state holds a **reference** — `hkp-asset://<id>` — as a whole field, and
never the content:

```json
"template": { "meta": { "status": 200 }, "body": "hkp-asset://player" }
```

`getState` echoes the reference and saving writes back what was configured, so
there is nothing to take back out on save. This is the same reason a secret is
`{{secret.…}}` in state rather than its value.

---

## Who resolves it

**The runtime that uses the content, at the moment it uses it**, from its own
**asset store**. The board's frontend does not substitute anything.

Each runtime's store is *pushed* the descriptors its services reference — only
those, since inline content can be large:

- with the **create payload**, so a service that loads content while being
  configured has it by then;
- before a **configuration** that names one the runtime has not been given;
- again on **attach**, because a runtime that restarted still has its services
  but has lost its store;
- and whenever an asset is **edited**. That push is the point: a service
  resolves its reference on its next use, so editing an asset changes what is
  served **without reconfiguring anything**.

A pipeline nested inside a service asks the runtime around it, as it does for
secrets, so an edit reaches it immediately too. The browser runtime needs no
push at all: its store *is* the board's `assets`.

A reference is *found* by its scheme anywhere in a string — so one that an
expression produces is still pushed to the runtime that will resolve it — but
*resolved* only as a whole value. Nothing is spliced into longer text: a page
that needs a script loads it as a second asset, the way the web does.

---

## Sources

| Source | Resolved by | |
|---|---|---|
| `text`, `base64` | anyone | already in the descriptor |
| `http://`, `https://` | the runtime using it | fetched by that runtime — never relayed through the browser — and revalidated with its ETag, or not at all when it has a `sha256` |
| `file://` | only a host that owns the path | on hkp-node, `file:///<volume>/<path>` inside the tenant's own volumes, read as [`filesystem`](../services/filesystem.md) reads. On hkp-rt, a path inside the folder `HKP_ASSET_ROOT` names, and nothing when it is unset. Anything outside is refused, never read |
| anything else | nobody | refused by name — `s3://` included, until a runtime has a client for it |

A `file://` source is deliberately narrow: a shared board naming
`file:///etc/passwd` behind an HTTP endpoint would otherwise be a leak.
hkp-python and the browser runtime cannot read one at all.

| Runtime | Store | Resolves |
|---|---|---|
| Browser | the board's `assets`, read as they are now — nothing is pushed | text, base64, `http(s)://` (as the source's CORS allows) |
| hkp-node | pushed; nested pipelines delegate | text, base64, `http(s)://`, `file://` in a volume |
| hkp-python | pushed; nested pipelines delegate | text, base64, `http(s)://` |
| hkp-rt | pushed; nested pipelines delegate | text, base64, `http(s)://`, `file://` under `HKP_ASSET_ROOT` |

---

## An asset that does not resolve

**Fails loudly.** An endpoint whose body names an asset it cannot resolve answers
`500` with the asset's id and the reason — an unknown id, a refused source, a
failed fetch, a hash that does not match — and reports it on the service. The
[`asset`](../services/asset.md) service answers with an error status. Neither
passes the reference on as if it were the content.

---

## Which services take one

Only the ones that consume content resolve a reference themselves:

- **HTTP endpoints** (`http-server-subservices` on hkp-node, hkp-python and
  hkp-rt): an answer whose
  `body` is a reference is sent as the asset's content, with the asset's media
  type unless the answer names one.
- **The [`asset`](../services/asset.md) service** puts an asset into the
  pipeline for any service that has no support of its own. This is how anything
  else uses an asset — by composition.

Everything else sees `hkp-asset://…` as the string it is.

---

## The asset view

A third way of looking at a board, beside its runtimes and the overview, switched
from the toolbar:

- **A list** of the board's assets: name, id, media type, where the content is,
  and its size.
- **An editor** for inline text, highlighted by media type. Changes take effect
  on **Apply**, which pushes the descriptor to the runtimes referencing it — never
  on each keystroke, since a page served half-written is worse than a stale one.
  A URL source is edited as a descriptor, with **Check** asking the runtimes that
  will use it whether it resolves.
- **Used by**: every service whose state names the asset, found by a scan of what
  the services hold now, each a way to that service.
- **New** from text, a file or a URL; **renaming** rewrites every reference;
  **deleting** one that is still referenced asks first. Inline content past a
  size suggests moving out to a URL — where it goes is the author's call.

---

## Units and deploying

A runtime's store is filled from the document that contributed the runtime. A
runtime a [unit](./units.md) brings resolves against that unit's assets, so
references are lexical and nothing needs renaming when units are composed.

A board deployed to a [coordinator](./cloud-boards.md) carries its descriptors,
and the coordinator sends each runtime it provisions the ones its services
reference.

---

## Where it lives in the code

| Concern | Where |
|---|---|
| The vocabulary: descriptors, the scheme, finding and renaming references | `hkp-frontend/src/runtime/board/assets.ts` |
| Pushing edits, *Used by*, checking | `hkp-frontend/src/core/assetActions.ts` |
| The browser runtime's resolver | `hkp-frontend/src/runtime/browser/assetResolver.ts` |
| The asset view | `hkp-frontend/src/assets/` |
| The runtimes' stores | `hkp-node/src/assets.ts`, `hkp-python/src/hkp/assets.py`, `hkp-rt/lib/include/assets.h` + `lib/src/assets.cpp` |
| The runtimes' routes | `POST /runtimes/:id/assets` (merge; `null` removes), `GET /runtimes/:id/assets/:assetId` (a check, never content) |
