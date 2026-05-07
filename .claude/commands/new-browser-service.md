---
description: Scaffold a new HKP browser runtime service end-to-end (service logic, UI, registration, demo board, docs)
allowed-tools: Read, Write, Edit, Bash
---

# New Browser Service

You are implementing a new browser runtime service for the HKP platform.
The user will describe what the service should do. Implement it end-to-end:
service logic, service UI, registration, contract test, demo board, and documentation.
Ask the user focused questions only where the design is genuinely ambiguous.

---

## What to produce

1. **`hkp-frontend/src/runtime/browser/services/<Name>.ts`** — service logic
2. **`hkp-frontend/src/runtime/browser/services/<Name>UI.tsx`** — service UI (if interactive config is needed)
3. Register in **`hkp-frontend/src/runtime/browser/registry/Default.ts`**
4. Add filename to **`SERVICE_DESCRIPTOR_FILES`** in `hkp-frontend/src/runtime/browser/services/tests/service-modules.contract.test.ts`
5. **`hkp-frontend/boards/<slug>-demo-board.json`** — demo board
6. **`docs/content/services/<slug>.md`** — documentation

The demo board is automatically linked in the docs UI via naming convention — no code changes needed in `DocumentationServices.tsx`.

---

## Service logic (`<Name>.ts`)

```typescript
/**
 * Service Documentation
 * Service ID: hookup.to/service/<slug>
 * Service Name: <Name>
 * Modes: <list modes if applicable>
 * Key Config: <key state fields>
 * IO: in=<type> -> out=<type>
 */

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import NameUI from "./NameUI";  // omit if no UI

const serviceId = "hookup.to/service/<slug>";
const serviceName = "<Name>";

type State = {
  myParam: string;
};

class Name extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { myParam: "default" });
  }

  configure(config: Partial<State>) {
    if (config.myParam !== undefined) {
      this.state.myParam = config.myParam;
      this.app.notify(this, { myParam: config.myParam });
    }
  }

  process(input: any): any {
    // transform input, return result
    // call this.pushErrorNotification("message") for user-visible errors
    return input;
  }
}

export default {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Name(app, board, descriptor, id),
  createUI: NameUI,  // omit if no UI
};
```

**Key rules:**
- `configure()` must update `this.state` and call `this.app.notify(this, {...})` for each changed field so the UI stays in sync
- `process()` return value is automatically passed to the next service — call `this.app.next(this, result)` explicitly only when you need to emit multiple values or skip the auto-next
- `this.bypass` is handled by the base class — do not check it manually in `process()`
- State fields set in the constructor become the defaults loaded when no saved state exists

**Modes pattern** (when the service has a fixed set of operating modes):

Extract the constants to a sibling file (`<name>-modes.ts`) to avoid a circular dependency. `<Name>.ts` imports `<Name>UI.tsx`, so if `<Name>UI.tsx` also imports from `<Name>.ts` you get a "Cannot access uninitialized variable" ReferenceError at runtime.

```typescript
// <name>-modes.ts
export const MODES = ["foo", "bar"] as const;
export type Mode = typeof MODES[number];
```

Both `<Name>.ts` and `<Name>UI.tsx` import from `<name>-modes.ts` instead of each other.

---

## Service UI (`<Name>UI.tsx`)

Use existing UI as reference:
- **Simple mode/option selector** → see `EncryptUI.tsx` (uses `SelectorField`)
- **Complex form with many fields** → see `MapUI.tsx` (uses `RadioGroup`, `MappingTable`)

```tsx
import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

export default function NameUI(props: ServiceUIProps) {
  const { service } = props;
  const [myParam, setMyParam] = useState("default");

  return (
    <ServiceUI
      {...props}
      onInit={(s: any) => { if (s.myParam !== undefined) setMyParam(s.myParam); }}
      onNotification={(n: any) => { if (n.myParam !== undefined) setMyParam(n.myParam); }}
    >
      <div className="flex flex-col" style={{ minWidth: 220 }}>
        <SelectorField
          label="Mode"
          options={{ foo: "Foo", bar: "Bar" }}
          value={myParam}
          onChange={({ value }) => {
            setMyParam(value);
            service.configure({ myParam: value });
          }}
        />
      </div>
    </ServiceUI>
  );
}
```

Available shared components (in `hkp-frontend/src/components/shared/`):
- `SelectorField` — labelled dropdown (keys=config values, values=display labels)
- `InputField` — text input with label
- `SecretField` — password input
- `Slider` — numeric slider

Available ui-components (in `hkp-frontend/src/ui-components/`):
- `RadioGroup` — horizontal button group for a small fixed set of options
- `Switch` — toggle
- `NumberInput`, `Checkbox`, `CheckboxGroup`, `MultiSelect`

---

## Registration

**`hkp-frontend/src/runtime/browser/registry/Default.ts`** — add import and entry:

```typescript
import NameDescriptor from "../services/Name";
// ...
export const defaultRegistry: Array<ServiceModule> = [
  // ... existing ...
  NameDescriptor,
];
```

**`hkp-frontend/src/runtime/browser/services/tests/service-modules.contract.test.ts`** — add filename:

```typescript
const SERVICE_DESCRIPTOR_FILES = new Set([
  // ... existing ...
  "Name.ts",  // or Name.tsx if it contains JSX
]);
```

The contract test auto-discovers service files by glob, loads those in `SERVICE_DESCRIPTOR_FILES`, and verifies each has `serviceId` containing `"hookup.to/service/"`, a non-empty `serviceName`, and a `create` function that returns an object with `uuid`, `board`, `app`, `configure`, and `process`.

---

## Demo board (`hkp-frontend/boards/<slug>-demo-board.json`)

Show the service doing something useful: a source (Injector or Timer), the new service, and a Monitor to display output. If the service has multiple modes, show a round-trip.

```json
{
  "boardName": "<Name> Demo",
  "runtimes": [{ "id": "ui", "name": "Browser", "type": "browser", "state": { "wrapServices": false } }],
  "services": {
    "ui": [
      { "uuid": "injector-svc", "serviceId": "hookup.to/service/injector", "serviceName": "Source", "state": { "recentInjection": "example value", "plainText": true } },
      { "uuid": "name-svc", "serviceId": "hookup.to/service/<slug>", "serviceName": "<Name>", "state": { "mode": "default-mode" } },
      { "uuid": "monitor-svc", "serviceId": "hookup.to/service/monitor", "serviceName": "Output" }
    ]
  }
}
```

The demo board filename **must** match `*-demo-board.json` for it to be picked up by `DocumentationServices.tsx`. The slug (filename without `-demo-board.json`) must match the doc's markdown filename for the demo banner to appear.

---

## Documentation (`docs/content/services/<slug>.md`)

```markdown
# <Name>

One-line description (shown in the service index).

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/<slug>` |

---

## What it does

[Explain the transformation. Describe each mode if applicable.]

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"a"` \| `"b"` | `"a"` | Operating mode |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | [describe] |
| **Output** | [describe] |

---

## Typical uses

[1-2 pipeline examples using the arrow notation: Service A → Service B → Service C]
```

The first line after `# <Name>` becomes the description shown in the services index. Keep it concise.

---

## Common patterns

**JSON-serialize non-string inputs** (so any pipeline value can pass through):
```typescript
const str = typeof input === "string" ? input : JSON.stringify(input);
```

**Try-parse JSON output** (so structured data survives a text round-trip):
```typescript
function tryParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}
```

**Notify on configure for UI sync** — always call `this.app.notify(this, { field: value })` when you update `this.state`, even inside `configure()`. The UI's `onNotification` handler is the only way the panel stays in sync after programmatic config changes from a board load or another service.

**Error reporting** — use `this.pushErrorNotification("message")` for user-visible errors; return `null` to signal no output without crashing the pipeline.
