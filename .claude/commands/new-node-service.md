---
description: Scaffold a new hkp-node runtime service end-to-end (service logic, registration, test, demo board, docs)
allowed-tools: Read, Write, Edit, Bash
---

# New Node Service (hkp-node)

You are implementing a new Node.js runtime service for the Readymade platform.
The user will describe what the service should do. Implement it end-to-end:
service logic, registry registration, test, demo board, and documentation.
Ask the user focused questions only where the design is genuinely ambiguous.

---

## What to produce

1. **`hkp-node/src/services/<name>.ts`** — service logic
2. Register in **`hkp-node/src/server.ts`** — import + factory entry
3. **`hkp-node/tests/<name>.test.ts`** — vitest integration test
4. **`boards/<slug>-demo-board.json`** — demo board
5. **`docs/content/services/<slug>.md`** — documentation
6. Check the page still indexes in **`readymade-mcp`** — see *Board Assist knowledge* below

---

## Service logic (`hkp-node/src/services/<name>.ts`)

```typescript
/**
 * Service Documentation
 * Service ID: <slug>
 * Service Name: <Name>
 * Runtime: hkp-node
 * Modes: <list modes if applicable>
 * Key Config: <key state fields>
 * IO: in=<type> -> out=<type>
 */

import type {
  HostedService,
  JsonRecord,
  RuntimeHost,
  ServiceConfiguration,
  ServiceRegistryEntry,
} from "../types";

export const nameDescriptor: ServiceRegistryEntry = {
  serviceId: "<slug>",
  serviceName: "<Name>",
};

type State = {
  myParam: string;
};

export class NameService implements HostedService {
  readonly serviceId = "<slug>";
  readonly serviceName = "<Name>";
  readonly uuid: string;

  private _state: State = { myParam: "default" };
  private _host?: RuntimeHost;

  constructor(config: ServiceConfiguration) {
    this.uuid = config.uuid;
    if (config.state) {
      this.configure(config.state);
    }
  }

  setHost(host: RuntimeHost): void {
    this._host = host;
  }

  configure(config: JsonRecord): JsonRecord {
    if (config.myParam !== undefined) {
      this._state.myParam = config.myParam as string;
    }
    return this.getState();
  }

  getState(): JsonRecord {
    return { ...this._state };
  }

  process(input: unknown, notify: (payload: unknown) => void): unknown {
    // transform input, return result
    // call notify({ key: value }) to push live updates to the UI
    // return null to stop pipeline propagation
    return input;
  }

  destroy(): void {
    // clean up timers, connections, file handles, etc.
  }
}
```

**Key differences from browser services:**

- `configure()` **returns** the updated state as a `JsonRecord` — there is no `app.notify()`. Return value is what gets synced to the UI.
- `process()` receives `notify` as a parameter — call it to push live state updates mid-processing without ending the call.
- `setHost()` gives access to `RuntimeHost` — only implement this if the service needs to trigger downstream processing on its own (timer pattern, HTTP listener pattern).
- `destroy()` is where you clean up timers, sockets, and any other resources. Always implement it if you opened anything.

**Modes pattern** — same as browser: extract constants to a sibling file to avoid circular imports if the UI also needs them.

---

## The `RuntimeHost` interface (for source/active services)

Only implement `setHost` when the service drives the pipeline rather than just reacting to it (timers, network listeners, etc.):

```typescript
interface RuntimeHost {
  processFrom(
    startAfterUuid: string, // start pipeline after this service's position
    data: unknown,
    onNotification: (n: { payload: unknown; instanceId: string }) => void,
  ): unknown;
  notify(payload: unknown, instanceId: string): void;
  emitResult(output: unknown): void;
}
```

Usage pattern (e.g., a timer tick):

```typescript
if (this._host) {
  const result = this._host.processFrom(this.uuid, { tickCount }, (n) =>
    this._host!.notify(n.payload, n.instanceId),
  );
  this._host.emitResult(result);
}
```

---

## Registration (`hkp-node/src/server.ts`)

1. Add the import with the other service imports:

```typescript
import { NameService, nameDescriptor } from "./services/name";
```

2. Add a factory entry to the `factories` Map (keep entries in alphabetical order within their category):

```typescript
[
  nameDescriptor.serviceId,
  {
    descriptor: nameDescriptor,
    create: (config, _createService) => new NameService(config),
  },
],
```

If your service needs to create sub-services (like `sub-service.ts`), use the `createService` parameter instead of ignoring it.

---

## Test (`hkp-node/tests/<name>.test.ts`)

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createServer } from "../src/server";

describe("<Name> service", () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    server = await createServer();
    // Create a runtime with the service under test
    await request(server.httpServer)
      .post("/runtimes")
      .send({
        id: "rt-test",
        name: "Test",
        services: [
          {
            serviceId: "<slug>",
            uuid: "name-svc",
            state: { myParam: "initial" },
          },
        ],
      })
      .expect(200);
  });

  afterEach(async () => {
    await server.close();
  });

  it("configure updates state", async () => {
    const res = await request(server.httpServer)
      .post("/runtimes/rt-test/services/name-svc")
      .send({ myParam: "updated" })
      .expect(200);

    expect(res.body.myParam).toBe("updated");
  });

  it("process passes data through", async () => {
    const res = await request(server.httpServer)
      .post("/runtimes/rt-test")
      .send({ hello: "world" })
      .expect(200);

    expect(res.body).toBeDefined();
  });
});
```

Run with: `cd hkp-node && npm test`

---

## Demo board (`boards/<slug>-demo-board.json`)

Show the service in a multi-runtime board: a browser injector sends data into a node runtime containing the new service, with a browser monitor showing the result.

```json
{
  "boardName": "<Name> Demo",
  "runtimes": [
    {
      "id": "ui",
      "name": "Browser",
      "type": "browser",
      "state": { "wrapServices": false }
    },
    {
      "id": "node",
      "name": "Node",
      "type": "rest",
      "state": { "wrapServices": false }
    },
    {
      "id": "ui-out",
      "name": "Browser Output",
      "type": "browser",
      "state": { "wrapServices": false }
    }
  ],
  "services": {
    "ui": [
      {
        "uuid": "injector-svc",
        "serviceId": "hookup.to/service/injector",
        "serviceName": "Source",
        "state": { "recentInjection": "example value", "plainText": true }
      }
    ],
    "node": [
      {
        "uuid": "name-svc",
        "serviceId": "<slug>",
        "serviceName": "<Name>",
        "state": { "myParam": "default" }
      }
    ],
    "ui-out": [
      {
        "uuid": "monitor-svc",
        "serviceId": "hookup.to/service/monitor",
        "serviceName": "Output"
      }
    ]
  }
}
```

Adjust the runtime chain to match what the service actually does. If it is purely a pass-through transformer, a single node runtime between two browser runtimes is the right shape.

---

## Documentation (`docs/content/services/<slug>.md`)

```markdown
# <Name>

One-line description (shown in the service index).

---

## Available in

| Runtime | Service ID |
| ------- | ---------- |
| Node.js | `<slug>`   |

---

## What it does

[Explain the transformation or function. Describe each mode if applicable.]

---

## Configuration

| Property  | Type     | Default     | Description |
| --------- | -------- | ----------- | ----------- |
| `myParam` | `string` | `"default"` | Description |

---

## Input / Output

|            | Shape      |
| ---------- | ---------- |
| **Input**  | [describe] |
| **Output** | [describe] |

---

## Typical uses

[1-2 pipeline examples: Browser Injector → Node <Name> → Browser Monitor]
```

---

## Board Assist knowledge (`readymade-mcp`)

The service page is also the source of the **service contract** the
`readymade-mcp` knowledge server gives Board Assist (`get_service_contract`,
`find_compatible_services`, `validate_board`). It reads the page, not the code,
so keep these shapes exactly:

- `## Available in` — a table row ``| hkp-node | `<service-id>` |`` (several
  ids in one cell as `` `a`, `b` ``), or a bullet ``- hkp-node — service ID `<id>` ``.
  The runtime cell must name the runtime (Browser, hkp-node, hkp-python, hkp-rt).
- `## Configuration` — a `| Property | Type | Default | Description |` table.
- `## Input / Output` — name the data types (`JSON`, `String`, `BinaryData`,
  `FloatRingBuffer`, `MixedData`, `Null`, …) in the input and output lines; that
  is what compatible-service lookups match on.

Keep the service id a quoted string in the service file (`serviceId: "<slug>"`) or name the file after it: `inspect_service_source` finds a service's source by either.

Then run `cd readymade-mcp && npm test`: *indexes every documented service page*
fails when a page yields no contract. Update the server itself only when the new
service brings something it does not know yet:

| New functionality | Update in `readymade-mcp/` |
|---|---|
| A data type | `knownTypes` in `src/repository.ts` |
| A runtime, or service source outside `hkp-node/src` | `sourceRoots` in `src/repository.ts`; `runtimeNames` / `normalizeRuntime` in `src/types.ts` |
| A board-level field or rule worth checking before a board loads | `src/validation.ts`, with a case in `tests/repository.test.ts` |
| A new kind of knowledge Board Assist should be able to ask for | a tool in `src/server.ts` + `src/schemas.ts`, and the allowlist in `hkp-frontend/src/assist/mcpKnowledge.ts` |

Board Assist's bundled offline documentation picks the page up on its own.

---

## Common patterns

**Stop propagation** — return `null` to prevent the runtime from passing anything to the next service or runtime:

```typescript
process(input: unknown, _notify: (p: unknown) => void): unknown {
  if (!isValid(input)) return null;
  return transform(input);
}
```

**Push live update to UI** — call `notify` at any point during processing; does not affect the return value:

```typescript
process(input: unknown, notify: (p: unknown) => void): unknown {
  notify({ status: "processing", received: input });
  const result = doWork(input);
  notify({ status: "done" });
  return result;
}
```

**Source service (drives the pipeline)** — implement `setHost`, schedule work, call `processFrom` + `emitResult`:

```typescript
setHost(host: RuntimeHost): void {
  this._host = host;
  this._interval = setInterval(() => this._tick(), this._state.intervalMs);
}

private _tick(): void {
  if (!this._host) return;
  const result = this._host.processFrom(this.uuid, { tick: Date.now() }, () => {});
  this._host.emitResult(result);
}

destroy(): void {
  if (this._interval) clearInterval(this._interval);
}
```

**Async processing** — `process` can be async; the runtime awaits the result:

```typescript
async process(input: unknown, notify: (p: unknown) => void): Promise<unknown> {
  const result = await fetchSomething(input);
  notify({ fetched: true });
  return result;
}
```

**Connecting somewhere a board names** — use `fetch`. On a hosted server
(`HKP_EGRESS=public`) every `fetch` is checked against private addresses by the
process's dispatcher (`src/egress.ts`), so a service gets that for nothing. A
library that opens its own socket (IMAP, SMTP) must be handed
`await reachableAddress(host)` — connect to the address it returns, with
`servername` for TLS — and report a refusal with `failureReason(err)`. Never
`net`/`tls.connect`, `http(s).request`, a `ws` client or an `undici` dispatcher
of your own: `tests/egress-sources.test.ts` fails on them.
