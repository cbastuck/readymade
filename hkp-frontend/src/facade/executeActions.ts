import { ConfirmAction, FacadeWidgetAction, WidgetAction } from "./types";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeBoardActions } from "./FacadeBoardActions";
import { findService, processService } from "./boardServices";
import { applyInput } from "./applyInput";

// Recursively replaces { "$state": "key" } objects with the corresponding
// facade state value. Runs before $$input substitution so both can coexist.
function resolveStateRefs(
  template: unknown,
  state: Record<string, unknown>,
): unknown {
  if (
    template !== null &&
    typeof template === "object" &&
    !Array.isArray(template)
  ) {
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

/**
 * Puts a question to the person using the facade and resolves with their
 * answer. Supplied by whatever renders the widget, since that is where the
 * question is shown.
 */
export type AskPerson = (question: ConfirmAction) => Promise<boolean>;

/**
 * Runs a widget's actions, in the order they are written and one at a time.
 *
 * Order is the whole point of awaiting: a button that configures a service and
 * then asks it to do its job means *that* configuration. Both legs cross to a
 * remote runtime as separate requests, so issuing them together lets the work
 * start against the settings the previous press left behind.
 */
export async function executeActions({
  action,
  actions,
  confirm,
  value,
  boardContext,
  setState,
  state,
  boardActions,
  byPerson = false,
  ask,
}: {
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
  // A widget's `confirm` shorthand: asked before any of the actions.
  confirm?: string;
  value: unknown;
  boardContext: BoardContextState;
  setState: (key: string, value: unknown) => void;
  // What the host showing this facade can do with the board itself. Absent for
  // a host that offers none of it, which makes a board action do nothing.
  boardActions?: FacadeBoardActions;
  // When provided, { "$state": "key" } references in configure payloads are
  // resolved against these values before $$input substitution runs.
  state?: Record<string, unknown>;
  // A person set these actions off — pressed, typed, picked — so what they
  // configure is an edit to the board. False for what a facade runs by itself,
  // such as its init actions.
  byPerson?: boolean;
  // How a confirm step reaches the person. Absent where there is nobody to ask,
  // which declines: consent that could not be asked for was not given.
  ask?: AskPerson;
}): Promise<void> {
  const all: WidgetAction[] = [
    ...(confirm ? [{ type: "confirm" as const, question: confirm }] : []),
    ...(action
      ? [
          {
            type: "configure" as const,
            serviceUuid: action.serviceUuid,
            configure: action.configure,
          },
        ]
      : []),
    ...(actions ?? []),
  ];

  for (const act of all) {
    if (act.type === "configure") {
      const service = findService(boardContext, act.serviceUuid);
      if (!service) {
        continue;
      }
      const configure: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(act.configure)) {
        const withState = state ? resolveStateRefs(v, state) : v;
        configure[k] = applyInput(withState, value);
      }
      await service.configure(configure);
      if (byPerson) {
        boardContext.markBoardChanged?.();
      }
    } else if (act.type === "process") {
      // Same substitution as a configure payload: what a board writes into one
      // it can write into the other.
      const withState = state
        ? resolveStateRefs(act.payload ?? {}, state)
        : (act.payload ?? {});
      processService(
        boardContext,
        act.serviceUuid,
        applyInput(withState, value),
      );
    } else if (act.type === "set-state") {
      // A written value wins over the widget's own, and `undefined` written on
      // purpose is still a value — which is why the field's presence decides
      // rather than its content.
      setState(act.key, "value" in act ? act.value : value);
    } else if (act.type === "board") {
      if (act.action === "partner-board-qr") {
        boardActions?.showPartnerBoardQr();
      }
    } else if (act.type === "confirm") {
      const withState = state
        ? resolveStateRefs(act.question, state)
        : act.question;
      const question = applyInput(withState, value);
      if (typeof question !== "string" || !question) {
        continue;
      }
      const agreed = ask ? await ask({ ...act, question }) : false;
      if (!agreed) {
        return;
      }
    }
  }
}
