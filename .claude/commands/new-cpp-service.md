---
description: Scaffold a new hkp-rt C++ runtime service end-to-end (header, optional .cpp, registration, config example, docs)
allowed-tools: Read, Write, Edit, Bash
---

# New C++ Service (hkp-rt)

You are implementing a new C++ service for the **hkp-rt** runtime.
The user will describe what the service should do. Implement it end-to-end:
service header, optional .cpp, registry registration, config example, and documentation.
Ask the user focused questions only where the design is genuinely ambiguous.

---

## What to produce

1. **`hkp-rt/lib/src/services/<Name>.h`** — service header (and `.cpp` if needed)
2. Register in **`hkp-rt/lib/src/registry.cpp`** — include + TypeList entry
3. **`boards/runtime-configs/<slug>-example.json`** — example runtime config
4. **`docs/content/services/<slug>.md`** — documentation
5. Check the page still indexes in **`readymade-mcp`** — see *Board Assist knowledge* below

---

## Service header (`hkp-rt/lib/src/services/<Name>.h`)

Use `monitor.h` as the minimal reference. All services inherit from `hkp::Service`.

```cpp
#pragma once

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: <slug>
 * Service Name: <Name>
 * Runtime: hkp-rt
 * Modes: <list modes if applicable>
 * Key Config: <key state fields>
 * IO: in=<type> -> out=<type>
 * Arrays: <yes/no/pass-through>
 * Binary: <yes/no/supported>
 * MixedData: <yes/no>
 */
namespace hkp {

class Name : public Service
{
public:
  static std::string serviceId() { return "<slug>"; }

  explicit Name(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j)
    {
      updateIfNeeded(m_myParam, (*j)["myParam"]);
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::mergeStateWith({
      { "myParam", m_myParam }
    });
  }

  Data process(Data data) override
  {
    // transform data and return result
    // return Null() to stop pipeline propagation
    return data;
  }

private:
  std::string m_myParam;
};

} // namespace hkp
```

**Key rules:**

- `static std::string serviceId()` is required by the `Registry::TypeList` machinery — it must be a static method returning the string ID.
- `configure()` must call `Service::configure(data)` and return its result — this handles bypass state and notifications.
- `getState()` must call `Service::mergeStateWith({...})` so that base fields (bypass, instanceId, etc.) are always included.
- `process()` returning `Null()` stops pipeline propagation; returning `data` passes it through.
- `updateIfNeeded(m_field, (*j)["key"])` is the idiomatic pattern — it only updates if the JSON key is present and the value differs, and returns `true` when updated.

---

## Bypass support

Override `onBypassChanged` to react to bypass toggle (e.g. stop/start a listener):

```cpp
bool onBypassChanged(bool bypass) override
{
  if (bypass)
  {
    stop();
  }
  else
  {
    start();
  }
  return bypass; // return true to confirm the change was applied
}
```

`isBypass()` returns the current bypass state. `mergeBypassState(state)` in `getState()` is called automatically by `mergeStateWith`.

---

## Subservices support

To support a configurable sub-pipeline (like `cache_subservices.h`), override `supportsSubservices()` and use `createSubRuntime`:

```cpp
bool supportsSubservices() const override { return true; }
```

In `configure()`, handle the `"pipeline"` key exactly as `CacheSubservices` does:

```cpp
if (j->contains("pipeline") && (*j)["pipeline"].is_array())
{
  m_subserviceConfig.clear();
  for (const auto& cfg : (*j)["pipeline"])
    m_subserviceConfig.push_back(cfg);
  rebuildSubservices();
}
// also handle "appendService", "removeService", "configureService" keys
```

In `getState()`:

```cpp
json pipeline = json::array();
if (m_subservices)
{
  for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
  {
    pipeline.push_back(json{
      {"serviceId", (*it)->getServiceId()},
      {"instanceId", (*it)->getId()},
      {"state", (*it)->getState()}
    });
  }
}
```

Required members:

```cpp
std::shared_ptr<SubRuntime> m_subservices;
std::vector<json> m_subserviceConfig;
```

Include `"../sub_runtime.h"` and `"../uuid.h"`.

---

## Source service pattern (service drives the pipeline itself)

For services that push data autonomously (network listeners, timers), use `emit()` for multi-output
and `next()` / `nextAsync()` for single-output from a background thread:

```cpp
// from a background thread or async callback:
emit(data);          // push partial result through outer pipeline without ending process()
next(data, true);    // single output, synchronous
nextAsync(data);     // single output, posts via io_context
```

These are thread-safe via the App's `io_context`.

---

## Files a board names

A path that comes from configuration or from the data is never opened as given:
resolve it through the files guard and open what that returns. It is reached
only inside the folders the runtime gives boards; a relative path lands in the
default one (`hkp-rt/lib/include/files.h`, `docs/content/concepts/runtime.md`,
"Where a board may read and write files").

```cpp
#include <files.h>

std::string problem;
auto path = files::resolve(m_path, problem);          // configured: inside a folder
if (!path) { std::cerr << problem << std::endl; return Null(); }
auto entry = files::resolveIn(*path, name, problem);  // from the data: inside m_path
auto in = files::input(*entry);                       // also files::output, files::list
```

`tests/files_sources.test.cpp` fails on an `ifstream`, `ofstream`, `fopen` or
directory iteration anywhere else in the library.

---

## Registration (`hkp-rt/lib/src/registry.cpp`)

1. Add `#include "./services/Name.h"` with the other includes.
2. Add `Name` to the `ServiceTypes` TypeList (alphabetical order within its category):

```cpp
using ServiceTypes = Registry::TypeList<
   // ... existing services ...
  ,Name
   // ...
>;
```

The `TypeList` machinery calls `Name::serviceId()` and `Name(instanceId)` automatically — no other registration code is needed.

---

## Config example (`boards/runtime-configs/<slug>-example.json`)

```json
{
  "runtimeId": "<slug>-example",
  "services": [
    {
      "serviceId": "<slug>",
      "instanceId": "<slug>-1",
      "state": {
        "myParam": "example-value"
      }
    },
    {
      "serviceId": "monitor",
      "instanceId": "monitor-1",
      "state": {
        "logToConsole": true
      }
    }
  ]
}
```

---

## Documentation (`docs/content/services/<slug>.md`)

```markdown
# <Name>

One-line description (shown in the service index).

---

## Available in

| Runtime | Service ID |
| ------- | ---------- |
| hkp-rt  | `<slug>`   |

---

## What it does

[Explain the transformation or function. Describe each mode if applicable.]

---

## Configuration

| Property  | Type     | Default | Description |
| --------- | -------- | ------- | ----------- |
| `myParam` | `string` | `""`    | Description |

---

## Bypass behaviour

[Describe what happens when bypassed — e.g. "stops listening, drops all connections".]

---

## Input / Output

|            | Shape      |
| ---------- | ---------- |
| **Input**  | [describe] |
| **Output** | [describe] |

---

## Subservices / pipeline

[If applicable: describe how sub-pipeline is configured and what it transforms.]

---

## Typical uses

[1-2 pipeline examples using the arrow notation: ServiceA → ServiceB → ServiceC]
```

---

## Board Assist knowledge (`readymade-mcp`)

The service page is also the source of the **service contract** the
`readymade-mcp` knowledge server gives Board Assist (`get_service_contract`,
`find_compatible_services`, `validate_board`). It reads the page, not the code,
so keep these shapes exactly:

- `## Available in` — a table row ``| hkp-rt | `<service-id>` |`` (several
  ids in one cell as `` `a`, `b` ``), or a bullet ``- hkp-rt — service ID `<id>` ``.
  The runtime cell must name the runtime (Browser, hkp-node, hkp-python, hkp-rt).
- `## Configuration` — a `| Property | Type | Default | Description |` table.
- `## Input / Output` — name the data types (`JSON`, `String`, `BinaryData`,
  `FloatRingBuffer`, `MixedData`, `Null`, …) in the input and output lines; that
  is what compatible-service lookups match on.

Keep the id returned by `serviceId()` a quoted string (`return "<slug>";`) or name the header after it: `inspect_service_source` finds a service's source by either.

Then run `cd readymade-mcp && npm test`: *indexes every documented service page*
fails when a page yields no contract. Update the server itself only when the new
service brings something it does not know yet:

| New functionality | Update in `readymade-mcp/` |
|---|---|
| A data type | `knownTypes` in `src/repository.ts` |
| A runtime, or service source outside `hkp-rt/lib` | `sourceRoots` in `src/repository.ts`; `runtimeNames` / `normalizeRuntime` in `src/types.ts` |
| A board-level field or rule worth checking before a board loads | `src/validation.ts`, with a case in `tests/repository.test.ts` |
| A new kind of knowledge Board Assist should be able to ask for | a tool in `src/server.ts` + `src/schemas.ts`, and the allowlist in `hkp-frontend/src/assist/mcpKnowledge.ts` |

Board Assist's bundled offline documentation picks the page up on its own.

---

## Common patterns

**Check and branch on data type:**

```cpp
if (auto j = getJSONFromData(data); j)       { /* JSON */ }
if (auto rb = getRingBufferFromData(data); rb) { /* FloatRingBuffer */ }
if (auto bin = getBinaryFromData(data); bin)  { /* BinaryData */ }
if (auto str = getStringFromData(data); str)  { /* std::string */ }
```

**Send a notification to the frontend:**

```cpp
sendNotification(json{{ "key", value }});
```

**Null check before propagation:**

```cpp
if (isNull(result)) return Null();
return result;
```

**Include guard + namespace boilerplate — always use `#pragma once` and `namespace hkp { ... }`.**
