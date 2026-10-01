# Asset

Puts one of the board's assets into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `asset` |
| Node.js (hkp-node) | `asset` |
| Python (hkp-python) | `asset` |
| C++ (hkp-rt) | `asset` |

---

## What it does

A board declares content once as an [asset](../concepts/assets.md) and services
name it as `hkp-asset://<id>`. A service that serves, plays or loads content
resolves a reference itself. **Asset** is for everything else: it emits the
asset's content so any service after it can use it.

The asset is **resolved on every pass**, from the runtime's asset store — in the
browser, the board's own `assets` — so editing the asset changes what the next
pass carries without reconfiguring anything.

Not meant for large content: a model does not belong in a pipeline frame.

---

## Configuration

| Property | Type | Description |
|---|---|---|
| `asset` | `string` | The reference emitted when the input names none, e.g. `"hkp-asset://card"` |

It also reports `mediaType` and `size` from the last pass, and `error` when the
last pass could not resolve its asset.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Anything — it only triggers the pass. A bare `hkp-asset://…` string, or an object whose `asset` field is one, names the asset for that pass instead of the configured one |
| **Output** | `{ meta, body }` for text, `{ meta, binary }` otherwise |

On hkp-rt a binary asset leaves as MixedData, `meta` beside the bytes.

`meta` is `{ status: 200, contentType, asset, size }` — shaped like an HTTP
response, as [`filesystem`](./filesystem.md)'s answers are, so an endpoint can
hand it straight back.

An asset that does not resolve is answered with an error status and the reason
(`{ meta: { status: 404 }, body: { error } }`) and reported on the service. The
reference itself is never passed on as though it were the content.

---

## Typical use

### Serve whichever asset a request names

```
http-server-subservices
  onRequest: map (path → hkp-asset://…) → asset
```

A Map turns the request into a reference and Asset answers with its content. For
a single page, an endpoint can name the asset as its response `body` directly and
needs no Asset service at all.

### Feed a template or a prompt to a service with no asset support

```
injector → asset (hkp-asset://prompt) → map (body → prompt) → text-generation
```

---

## Demo

The demo board injects `hkp-asset://greeting` to show an input naming the asset,
and is otherwise configured with `hkp-asset://card`. Open the asset view, edit
either and press **Apply**: the next run carries the new content.
