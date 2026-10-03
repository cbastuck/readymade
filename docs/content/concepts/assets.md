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
| `sha256` | the version: an integrity check, and what lets a runtime cache a URL without asking again |
| `size` | for the view, and for refusing oversized content |
| `name` | what a person calls it |
| `runtimes` | the runtimes that are given it, by id. Absent: every runtime of the document declaring it |

An entry missing what is required is left out when the board loads, and named in
a warning; it costs that one asset, not the board. The optional fields are kept
where they are well-formed and dropped where they are not — a `sha256` that is
not 64 hex digits, a header whose value is not a string — which is how every
runtime reads the same descriptor.

**An asset carries no request headers and names no secret.** A `url` source is
an address anyone may fetch. An asset is resolved without anyone looking, by
every runtime holding it — no place for a credential, and a header written into
the board would travel with every copy of it. A descriptor that declares
`headers` is read without them, and says so. Content that needs a credential is
fetched by a service that shows where it sends it, like
[`http-client`](../services/http-client.md), or read from a `file://` source on
the runtime's own host.

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

Each runtime's store is *pushed* the descriptors of its document — **all of
them**, whether or not one of its services names them. Which asset a service
uses can be decided while the board runs — by the input of an
[`asset`](../services/asset.md) service, by the response an endpoint is handed
— so a reference has to resolve wherever it arrives. What is pushed is the
descriptor: for content at a `url`, an address, not the content.

An asset that should not be everywhere says where it belongs:

```json
{ "id": "ledger", "mediaType": "application/json", "text": "…", "runtimes": ["node"] }
```

Only the runtimes it names are given it, the browser runtime included; on any
other, a reference to it does not resolve.

The pushes happen:

- with the **create payload**, so a service that loads content while being
  configured has it by then;
- again on **attach**, because a runtime that restarted still has its services
  but has lost its store;
- and whenever an asset is **edited**. That push is the point: a service
  resolves its reference on its next use, so editing an asset changes what is
  served **without reconfiguring anything**.

A pipeline nested inside a service asks the runtime around it, as it does for
secrets, so an edit reaches it immediately too. The browser runtime needs no
push at all: its store *is* the board's `assets`.

A reference is *found* by its scheme anywhere in a string — which is how the
asset view says where an asset is used, and how a rename reaches every mention —
but *resolved* only as a whole value. Nothing is spliced into longer text: a
page that needs a script loads it as a second asset, the way the web does.

---

## Sources

| Source | Resolved by | |
|---|---|---|
| `text`, `base64` | anyone | already in the descriptor |
| `http://`, `https://` | the runtime using it | fetched by that runtime as anyone would fetch it — never relayed through the browser, with no headers of the board's, following redirects to other `http(s)` addresses — and revalidated with its ETag, or not at all when it has a `sha256` |
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

**Inline content has a size.** A descriptor travels in the requests that
configure a runtime, so what it carries itself — `text`, `base64` — is limited:
on hkp-node to 8 MB per asset (`HKP_MAX_INLINE_ASSET_BYTES`), and to 32 MB for
everything one request carries (`HKP_MAX_ASSET_REQUEST_BODY_BYTES`). Since a
runtime is given all of its board's assets, that second number is how much
inline content a board may hold. Content past either is named by `url` and
fetched by the runtime, where the limit is the runtime's own.

---

## An asset that does not resolve

**Fails loudly.** An endpoint whose body names an asset it cannot resolve answers
`500` with the asset's id and the reason — an unknown id, a refused source,
content that is not base64, a failed fetch, a hash that does not match — and
reports it on the service. The
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
  on **Apply**, which pushes the descriptor to the runtimes given it — never
  on each keystroke, since a page served half-written is worse than a stale one.
  A runtime that did not take the push goes on using the version before, so it
  is named on the asset and **Apply** stays available to send it again.
  A URL source is edited as a descriptor, with **Check** asking the runtimes
  given it whether it resolves.
- **Given to**: every runtime, including one added later, or only the ones
  ticked — and then taken from a runtime that is unticked. Ticking all of them
  is still a list: a runtime added later is not on it.
- **Used by**: every service on the board's own runtimes whose state names the
  asset, found by a scan of what the services hold now, each a way to that
  service.
- **New** from text, a file or a URL. **Renaming** gives the asset under its new
  id to the runtimes it is for, then rewrites every reference, then
  removes the old id — so no service is told to use an id its runtime has not
  been given, and the board declares both ids until the last reference has
  moved. A runtime or a service that does not take its part puts the rename
  back, and the new id is taken back from the runtimes that were given it.
- **Deleting** one that is still referenced asks first. A runtime the deletion
  did not reach still holds the asset — out of the board, but there for an
  `asset` service asked for it by name — so it is named, with a retry.
- Inline content past a size suggests moving out to a URL — where it goes is
  the author's call.

What is being edited belongs to the board that is open: an edit not yet applied
is dropped when another board replaces it, and one still on its way to the
runtimes stops where it is.

---

## Units and deploying

A runtime's store is filled from the document that contributed the runtime. A
runtime a [unit](./units.md) brings resolves against that unit's assets, so
references are lexical and nothing needs renaming when units are composed. The
same id in the board and in a unit names two assets: the asset view lists, checks
and pushes the board's own, and an `asset` service's panel offers the ones its
runtime resolves against. An asset's `runtimes` name runtimes of the document
that declares it, by the ids they have there.

> **Warning — unit assets are not deployed:** A board deployed to a
> [coordinator](./cloud-boards.md) carries only the top-level board's asset
> descriptors. A runtime contributed by a unit receives none of that unit's
> assets. Any service on that runtime that uses `hkp-asset://…` for a
> unit-owned asset will fail to resolve it after deployment. Such boards work
> locally, but cannot currently be deployed correctly while they depend on
> unit-owned assets.

For the top-level board's own runtimes, the coordinator sends all of the
top-level board's descriptors, less those restricted to other runtimes — as the
browser does.

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
