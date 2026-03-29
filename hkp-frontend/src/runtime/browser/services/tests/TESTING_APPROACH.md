# Service Unit Testing Approach

A guide for writing tests for the non-UI services under `src/runtime/browser/services/`.

Two completed examples to reference: `map-service.test.ts`, `timer-service.test.ts`.

---

## 1. Before Writing the First Test — Read the Service

Open the service file and answer these questions before writing anything:

| Question                                                       | Where to look                                             |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| What modes/states does the service have?                       | Constructor defaults + `State` type                       |
| What does `configure()` accept, and what are its side effects? | Destructured keys, `app.notify` calls                     |
| What does `process()` do per mode?                             | Branching on `this.state.*` or `this.*` properties        |
| Does it use timers, `sleep`, external calls?                   | `setTimeout`, `setInterval`, `fetch`, imports             |
| Does it have helper methods that can be tested independently?  | Non-private methods other than configure/process          |
| What does the descriptor export?                               | `export default { serviceName, serviceId, service, ... }` |

For services that extend `ServiceBase`, check `getConfiguration()` — it returns `{ ...this.state, bypass }`.

---

## 2. Test File Location & Naming

```
src/runtime/browser/services/tests/<service-name>-service.test.ts
```

Always `.test.ts` (not `.tsx`) unless the service imports React components.  
Import the service via a relative path from the `tests/` folder:

```ts
import FooDescriptor from "../base/Foo"; // or "../Foo" for top-level services
const FooService = FooDescriptor.service; // or FooDescriptor.Map, etc.
```

---

## 3. Standard Test Structure

### Describe groups (in order)

1. **Descriptor shape** — `serviceName`, `serviceId`, constructor produces callable methods
2. **Default state** — every initial property value
3. **`configure()` — property updates** — each key sets the right field and calls `app.notify` with correct payload
4. **`configure()` — commands** (start/stop/restart/inject/etc.) — one group per logical command family
5. **Core behaviour per mode** — one `describe` per mode (e.g. `replace mode`, `periodic mode`)
6. **`process()` behaviour** — grouped by mode or scenario
7. **Edge cases** — errors, empty input, boundary values, concurrent calls
8. **Helper methods** (if any)
9. **`destroy()`**

### Mock app factory

Every test creates a fresh `mockApp`. Keep it minimal — add only what the service actually calls:

```ts
function createMockApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    // add others only if the service calls them
  };
}

function createService() {
  const app = createMockApp();
  const svc = new FooService(app as any, "test-board", {} as any, "svc-1");
  return { svc, app };
}
```

---

## 4. Fake Timers

Any service that uses `setTimeout`, `setInterval`, or `sleep()` must use fake timers.  
Scope them to the relevant `describe` block only — not the whole file:

```ts
describe("...", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("fires after 500 ms", () => {
    // ...setup...
    vi.advanceTimersByTime(500);
    expect(app.next).toHaveBeenCalledTimes(1);
  });

  it("async process with sleep", async () => {
    const p = svc.process({});
    vi.advanceTimersByTime(200); // unblock the sleep
    const result = await p;
    expect(result).toEqual(...);
  });
});
```

---

## 5. Async / Promise Tests

If `configure()` or `process()` returns a promise, `await` it.  
Verify the `try-catch` error recovery actually fires by checking what the service
returns on bad input — if a `return` inside an `async` reduce is not `await`ed the
catch is bypassed (this was fixed in `Map`).

---

## 6. What to Assert — Priority Order

1. **Return value of `process()`** — shape, values, type
2. **`app.notify` calls** — payload keys and values
3. **`app.next` calls** — for services that push downstream
4. **Internal state** — `this.running`, `this.counter`, etc. when observable
5. **`getConfiguration()` / state** after configure calls

Use `toHaveBeenCalledWith(service, { key: value })` for notify assertions — the first argument is always the service instance itself.

---

## 7. Bugs to Watch For (Discovered So Far)

| Service | Bug                                                                                                                         | Fix                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `Map`   | `mapper` returned rather than `await`-ed the async reduce, so `try-catch` never caught rejected expression evaluations      | Added `await` to both the scalar and reduce return paths |
| `Timer` | `clearTimer()` notified `running: false` but never set `this.running = false`, so `running` stayed `true` after `destroy()` | Set `this.running = false` inside `clearTimer()`         |
| `Timer` | `until` check used `>` instead of `>=`, firing one extra tick beyond the limit                                              | Changed to `>=`                                          |

Keep this table updated as new bugs are found.

---

## 8. Checklist Before Committing

- [ ] All `describe` groups listed in §3 are present (skip only if genuinely inapplicable)
- [ ] Fake timers are scoped to the right blocks (not global)
- [ ] No real `sleep` / `setTimeout` calls in test code itself
- [ ] Each `it` creates a fresh service instance (no shared state between tests)
- [ ] `app.notify.mockClear()` used when asserting call counts mid-test
- [ ] Failing tests prompted investigation of the service source — bugs fixed there, not worked around in the test

---

## 9. Services Completed

| Service                   | Test file                          | Bugs found & fixed                            |
| ------------------------- | ---------------------------------- | --------------------------------------------- |
| `Map` (`base/Map.ts`)     | `map-service.test.ts` (59 tests)   | Async error recovery bypass                   |
| `Timer` (`base/Timer.js`) | `timer-service.test.ts` (45 tests) | `clearTimer` running flag; `until` off-by-one |

## 10. Services Still To Do

Run `find src/runtime/browser/services -maxdepth 2 -name '*.ts' -o -name '*.tsx' -o -name '*.js' | grep -v test | grep -v UI` for the full list.  
Good next candidates (pure logic, no browser APIs):

- `Filter.tsx` — map + filter expression evaluation
- `GroupBy.ts` — grouping logic
- `Aggregator.ts` — interval-based aggregation
- `Stack.tsx` — push/pop/peek operations
- `Delay.tsx` — sleep-based delay
- `Injector.ts` — property injection
- `UuidGenerator.ts` — simple, good warm-up
- `Switch.tsx` — routing by value
