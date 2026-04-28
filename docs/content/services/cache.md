# Cache

Stores and retrieves pipeline values by key; avoids redundant downstream computation for repeated inputs.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/cache` |
| hkp-rt | `cache` |

---

## What it does

Cache intercepts each incoming value, checks whether a cached result for the current key already exists, and if so returns it immediately — skipping the rest of the pipeline for that input. If no cached value exists, the data is forwarded downstream; when a result comes back, it is stored under the key for future use.

### Browser runtime

The browser Cache is a general-purpose in-memory store that can be merged incrementally. It supports two update strategies (controlled by `updateTrigger`):

- **`config`** — the cache is updated when `configure()` is called with `cache+` or `cacheProperties+`.
- **`process`** — the cache is updated on each pipeline tick (the incoming value is merged in).

### hkp-rt

The hkp-rt Cache caches the result of downstream pipeline processing (i.e. the return value of `next(data)`) using a string key derived from the input. Results can optionally be persisted to disk so they survive restarts.

---

## Configuration

### Browser

| Property | Type | Default | Description |
|---|---|---|---|
| `initial` | `any` | `undefined` | Initial cache value |
| `updateTrigger` | `"config"` \| `"process"` | `"config"` | When the cache is updated |
| `cache+` | `object` | — | Merges the given object into the cached value |
| `cacheProperties+` | `string[]` | — | List of property names to pluck from the config and merge |
| `cacheMeta.triggerProcess` | `boolean` | `false` | When `true`, fires the cached value downstream after updating |

### hkp-rt

| Property | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | `""` | Inja template evaluated against the input to produce the cache key |
| `outputKey` | `string` | `"path"` | Key under which the cached file path is returned |
| `persistRoot` | `string` | `""` | Directory path for on-disk persistence; empty = memory only |
| `persistMode` | `string` | `""` | `"sha"` (default) or `"filename"` — controls how the on-disk filename is derived |
| `filenameTemplate` | `string` | `""` | Inja template for the filename when `persistMode` is `"filename"` |
| `cacheDuration` | `string` | `""` | Max age before a cached entry is considered stale (e.g. `"24h"`, `"7d"`) |
| `excluded` | `string[]` | `[]` | List of regex patterns; keys matching any pattern bypass the cache |

---

## Input / Output

### Browser

| | Shape |
|---|---|
| **Input** | Any value |
| **Output** | Cached value (or updated cache value after merge) |

### hkp-rt

| | Shape |
|---|---|
| **Input** | Any — key template is evaluated against it |
| **Output** | The cached downstream result (early-return), or the freshly computed result after forwarding |

---

## Example (hkp-rt): cache HTTP responses for 24 hours

```json
{
  "serviceId": "cache",
  "config": {
    "key": "{{ params.url }}",
    "persistRoot": "/tmp/hkp-cache",
    "cacheDuration": "24h"
  }
}
```

Place this before an `http-client` service. The first request for each URL hits the network; subsequent requests within 24 hours are served from disk.
