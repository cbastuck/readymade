# TODO: Extract shared scope-wiring helper (desktop + mobile)

**Status:** proposed — do only if the drift keeps biting.
**Priority:** low (incremental cleanup, not a bug). A concrete instance of this
drift was just fixed; see "Background" below.

## Problem

The side-effecting wiring that attaches callbacks to a runtime `scope` —
`onResult`, `onConfig`, `onAction`, `processRuntimeByName`,
`configureServiceInRuntime`, plus `authenticatedUser` — is implemented in **two
independent places** that have already drifted:

- **Desktop:** the per-runtime view components install it. `RuntimeUI`
  (`src/ui-components/runtime-ui/index.tsx`) dispatches by runtime type to
  `BrowserRuntime` (`src/runtime/browser/BrowserRuntime.tsx`), `RuntimeRest`
  (`src/runtime/rest/RuntimeRest.tsx`), and `RuntimeGraphQL`
  (`src/runtime/graphql/RuntimeGraphQL.tsx`), each of which does
  `scope.onResult = onResult` etc. The actual `onResult` body lives in
  `Board`'s `onRuntimeResult` (`src/views/playground/Board/index.tsx`), which
  also owns the inversion-of-control resolver bookkeeping
  (`registerPendingBoardCallback` / `processPendingBoardCallbacks`, keyed by
  `context.requestId`).

- **Mobile:** the mobile renderer mounts none of those view components, so it
  hand-rolls the wiring in `useWireBrowserScopes`
  (`src/views/playground/mobile/MobileBoardCanvas.tsx`). It re-implements the
  `onResult` body (bridge `result-from-browser`, `context.onResolve`, local
  chaining) and the browser-only hooks.

Because the mobile copy is a partial re-implementation, it is easy for one side
to gain behavior the other lacks.

## Background (the drift that prompted this)

`useWireBrowserScopes` originally `continue`d past every non-browser runtime, so
REST (C++) runtime scopes on mobile kept the unset `RuntimeRestScope.onResult`
stub. A C++ HTTP server using the inversion-of-control pull pattern pushes its
result with `context.onResolve` set (`RESULT_AWAITING_RESPONSE`) and parks the
HTTP connection until the app resolves it. With the stub, that resolve never
fired and the request hung forever (observed in the embedded meander-ios webview
with the live-location demo board). Fixed by wiring `scope.onResult` for every
runtime in `useWireBrowserScopes`, keeping the other hooks browser-only.

That fix is correct but widens the duplication — hence this refactor.

## Proposed direction

Extract the **side-effecting, presentation-free** scope wiring into one helper
that both the desktop runtime components and the mobile `useWireBrowserScopes`
call. Sketch:

```ts
// e.g. src/runtime/wireScope.ts
type WireScopeDeps = {
  runtimes: RuntimeDescriptor[];
  scopes: Record<string, RuntimeScope>;
  runtimeApis: Record<string, RuntimeApi>;
  user: User | null;
  bridge?: { ws: WebSocket | null };          // cloud coordinator, if present
  onNotification?: (payload: unknown) => void; // app-level notification sink
};

function wireScope(rt: RuntimeDescriptor, scope: RuntimeScope, deps: WireScopeDeps): void;
```

Parameterize by **runtime type** (browser vs REST/remote — only browser gets
`processRuntimeByName` / `configureServiceInRuntime` / `onAction`) and by
**bridge presence** (coordinator routing vs. local chaining). Keep all React/DOM
out of it so mobile can call it without dragging desktop UI in.

### Why not just mount `<RuntimeRest>` on mobile

Rejected: those are presentational components (render `ServiceUiContainer`,
drag/drop, desktop styling) that also manage their own `servicesWithConfig`
state and `onConfig`. Mounting them headless purely for the `scope.onResult`
side-effect abuses the component and risks double-managing state that
`BoardContext` / `MobileBoardCanvas` already own. The wiring is the shared part,
not the rendering — so extract the wiring.

## Scope / acceptance

- One helper is the single source of truth for attaching scope callbacks.
- Desktop `BrowserRuntime` / `RuntimeRest` (and ideally `RuntimeGraphQL`) and
  mobile `useWireBrowserScopes` both call it; no behavioral change on desktop.
- Decide whether the mobile path should also adopt desktop's
  `registerPendingBoardCallback` / `processPendingBoardCallbacks` resolver map so
  inversion-of-control results resolve at the *end* of the chain rather than at
  the first runtime carrying `onResolve`. (Today mobile resolves immediately when
  `context.onResolve` is present; desktop forwards the context along the chain.
  Equivalent when the awaiting runtime is last, which is the common case.)
- Cover with the existing runtime-processing integration tests
  (`src/runtime/browser/tests/runtime-processing.integration.test.ts`) extended
  for a REST/remote runtime.

## Affected files

- `src/views/playground/mobile/MobileBoardCanvas.tsx` (`useWireBrowserScopes`)
- `src/runtime/rest/RuntimeRest.tsx`
- `src/runtime/browser/BrowserRuntime.tsx`
- `src/runtime/graphql/RuntimeGraphQL.tsx`
- `src/views/playground/Board/index.tsx` (`onRuntimeResult` + pending-callback map)
- `src/ui-components/runtime-ui/index.tsx`
