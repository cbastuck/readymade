# Board JSON

Every board is a single JSON document — readable, diffable, and the whole of what a board is.

---

## The shape

Two keys carry a board, and they are the two the loader actually insists on
(`isBoardDescriptor` checks for these and nothing else):

| Key | |
|---|---|
| `runtimes` | an ordered array of execution environments. **Order is the chain**: the result of one becomes the input of the next |
| `services` | a map from runtime id to that runtime's ordered service list. **Order is the pipeline** |

Everything else is optional:

| Key | |
|---|---|
| `boardName` | display name |
| `description` | a sentence about the board, shown where boards are listed |
| `facade` | the app-like surface of widgets drawn over the board |
| `unit` | what this board imports and exports, if it is used as a unit |
| `units` | the boards this one is assembled from → `concepts/units.md` |
| `registry` | what a runtime reported it could build. Written by machinery, not authored |

```json
{
  "boardName": "My Board",
  "description": "optional, shown in the board list",
  "runtimes": [ /* runtime descriptors, in chain order */ ],
  "services": {
    "<runtimeId>": [ /* service instances, in pipeline order */ ]
  },
  "facade": { /* optional */ },
  "units": [ /* optional */ ]
}
```

There is no version field and no schema URL. A board is read by the code that
holds these types (`hkp-frontend/src/types.ts`), and unknown keys are carried
along rather than rejected.

---

## Runtime descriptor

```json
{
  "id": "my-runtime",
  "name": "My Runtime",
  "type": "rest",
  "url": "https://server.example.com",
  "color": "#7c3aed",
  "state": { "minimized": false, "wrapServices": true }
}
```

| Field | |
|---|---|
| `id` | **required.** The stable key everything else in the document uses — the `services` map, mount references, the chain |
| `name` | **required.** A display label, and what `processRuntimeByName` matches |
| `type` | **required.** `browser`, `rest` or `graphql` |
| `url` | for a remote runtime: where to reach it |
| `color`, `bundles` | presentation, and plugin libraries to load. Beside `state`, not inside it |
| `state` | per-runtime settings — see below |

**Two older spellings still load**: `realtime` means `rest` and `remote` means
`graphql`. Boards in the wild carry them, so anything comparing a type should
compare canonical forms (`toCanonicalRuntimeClassType`).

A `url` need not be a plain address:

- `HKP_RUNTIME_HOST` is substituted at load, for boards written before the host
  is known;
- `hkp://remotes/<name>` addresses the runtime the app itself embeds →
  `concepts/runtime.md`.

`state` holds what the runtime remembers between loads: display preferences like
`minimized` and `wrapServices`, and — once a board is deployed and logging is
switched on — `logging`, `logLevel` and `logData` → `concepts/logging.md`.

---

## Service instance

```json
{
  "uuid": "timer-svc",
  "serviceId": "hookup.to/service/timer",
  "serviceName": "Timer",
  "state": {
    "periodic": true,
    "periodicValue": 300,
    "periodicUnit": "ms",
    "running": true
  }
}
```

| Field | |
|---|---|
| `uuid` | **required.** Unique *within its runtime* — see below |
| `serviceId` | **required.** What the runtime looks up to build the service |
| `serviceName` | **required in practice.** A display label with no effect on behaviour |
| `state` | whatever the service last reported |

### The uuid is scoped to its runtime, not the board

Two runtimes may each hold a service called `intake`; that has always been
legal, and composing boards from units depends on it — a unit contributes whole
runtimes, and its service uuids are never rewritten because the runtime already
scopes them (`concepts/units.md`).

The consequence: nothing addresses a service by uuid alone. A facade widget, a
mount reference, a configure call — each names the runtime and the uuid
together.

### `serviceId` is the one that matters

It is what the registry resolves. When a board names an id the registry no
longer has, the service is not built: the board still opens, looking fine, minus
a piece. That failure is quiet enough that two test suites exist to catch it →
`testing.md`.

`serviceName` exists so the JSON reads without consulting a registry. Renaming
it changes nothing.

### `state` is a report, not a form

A service's state is what that service last said about itself, which means it
holds both what you configured and anything the machinery wrote there. Keys
beginning `__hkp` are reserved for that machinery — `__hkpMount` is the address
a mount currently has (`concepts/mounts.md`) — and a service must not use such a
name for anything of its own.

---

## What a board does and does not contain

**No secret values.** A credential appears only as a reference —
`{{secret.smtp}}` — which is resolved at the point of use and never reported
back through `getState`. That is what makes a board safe to commit and to share,
and it is a designed property rather than a convention: a resolved value cannot
travel back out the way it came in.

**But not free of machine-written state.** Since `state` is a report, a board can
carry a resolved endpoint or a port the system assigned. A runtime asked for
`"port": 0` is given a free one, and saving the board writes down the one it
got.

**Complete, but not self-contained.** The document says everything about the
board. It does not carry the things the board *reaches* — a board naming a
runtime on a machine at your desk is a board about your desk, and it opens
elsewhere only as far as that runtime is reachable.

---

## Working with the document

The board menu is where the JSON itself is reachable:

| | |
|---|---|
| **Edit Board Source** | shows the document and rebuilds the board from whatever you apply |
| **Download Source** | writes it to a file |
| **Create share link** | packs it into a URL, so sharing a board is sharing an address |

A board can also be opened straight from a link — which is how every demo board
on this site opens in the playground.

Committing boards to git gives a readable history: adding a service appends one
object to an array, changing a setting updates one value in a `state` object. No
binary blobs and no generated identifiers, so a diff shows what somebody
actually changed.

---

## Where it lives in the code

| Concern | Where |
|---|---|
| The types | `hkp-frontend/src/types.ts` (`BoardDescriptor`, `RuntimeDescriptor`, `ServiceDescriptor`) |
| What counts as a board | `hkp-frontend/src/types.ts` (`isBoardDescriptor`) |
| Reading and writing one | `hkp-frontend/src/core/boardPersistence.ts` |
| Facade shape | `hkp-frontend/src/facade/types.ts` |
| Unit and composition shape | `hkp-frontend/src/runtime/board/units.ts` |
| Example boards | `hkp-frontend/boards/` |

---

See also: **Board** (`concepts/board.md`) for what the document means when it is
running, and **Units and compositions** (`concepts/units.md`) for assembling one
board out of several.
