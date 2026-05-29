import { FacadeWidgetAction, WidgetAction } from "./types";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { findService } from "./findService";
import { applyInput } from "./applyInput";

// Recursively replaces { "$state": "key" } objects with the corresponding
// facade state value. Runs before $$input substitution so both can coexist.
function resolveStateRefs(template: unknown, state: Record<string, unknown>): unknown {
  if (template !== null && typeof template === "object" && !Array.isArray(template)) {
    const obj = template as Record<string, unknown>;
    if ("$state" in obj && typeof obj["$state"] === "string") {
      return state[obj["$state"]];
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveStateRefs(v, state);
    }
    return result;
  }
  if (Array.isArray(template)) {
    return template.map((v) => resolveStateRefs(v, state));
  }
  return template;
}

export function executeActions({
  action,
  actions,
  value,
  boardContext,
  setState,
  state,
}: {
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
  value: unknown;
  boardContext: BoardContextState;
  setState: (key: string, value: unknown) => void;
  // When provided, { "$state": "key" } references in configure payloads are
  // resolved against these values before $$input substitution runs.
  state?: Record<string, unknown>;
}): void {
  const all: WidgetAction[] = [
    ...(action
      ? [{ type: "configure" as const, serviceUuid: action.serviceUuid, configure: action.configure }]
      : []),
    ...(actions ?? []),
  ];

  for (const act of all) {
    if (act.type === "configure") {
      const service = findService(boardContext, act.serviceUuid);
      if (!service) { continue; }
      const configure: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(act.configure)) {
        const withState = state ? resolveStateRefs(v, state) : v;
        configure[k] = applyInput(withState, value);
      }
      service.configure(configure);
    } else if (act.type === "set-state") {
      setState(act.key, value);
    }
  }
}
