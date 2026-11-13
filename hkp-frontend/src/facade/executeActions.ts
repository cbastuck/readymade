import {
  ConfirmAction,
  FacadeWidgetAction,
  PromptAction,
  WidgetAction,
} from "./types";
import { serviceForUserInterface } from "../types";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeBoardActions } from "./FacadeBoardActions";
import { FacadePanelNavigation } from "./FacadePanelNavigation";
import { findService, processService } from "./boardServices";
import { applyInput } from "./applyInput";
import { FacadeIdentity, isUserRef, resolveUserRef } from "./FacadeIdentity";
import type { SentVerb } from "./sentCalls";

// Recursively resolves facade-state and action-time references. Runs before
// $$input substitution so all of them can coexist in one payload.
function resolveActionRefs(
  template: unknown,
  state: Record<string, unknown>,
  identity?: FacadeIdentity,
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
    // Who the person is, as the facade may show it. A payload carrying it is
    // carrying a claim: a service that has to know who is calling asks the
    // run, not its input.
    if (isUserRef(obj)) {
      return resolveUserRef(obj, identity);
    }
    // Values created at the moment somebody acts. A board can persist and
    // forward the same event identity and timestamp without a purpose-built
    // browser service in front of every form that records something.
    if (obj["$now"] === true) {
      return new Date().toISOString();
    }
    if (obj["$uuid"] === true) {
      return crypto.randomUUID();
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveActionRefs(v, state, identity);
    }
    return result;
  }
  if (Array.isArray(template)) {
    return template.map((v) => resolveActionRefs(v, state, identity));
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
 * Asks the person for a value and resolves with what they entered, or null
 * when they cancelled.
 */
export type AskPersonForValue = (
  question: PromptAction,
) => Promise<string | null>;

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
  identity,
  boardActions,
  navigation,
  byPerson = false,
  ask,
  askValue,
  onSent,
}: {
  action?: FacadeWidgetAction;
  actions?: WidgetAction[];
  // A widget's `confirm` shorthand: asked before any of the actions.
  confirm?: string;
  value: unknown;
  boardContext: BoardContextState;
  // `step` is the set-state's position in `actions`, for a caller that says
  // which of its actions wrote — init does.
  setState: (key: string, value: unknown, step?: number) => void;
  // What the host showing this facade can do with the board itself. Absent for
  // a host that offers none of it, which makes a board action do nothing.
  boardActions?: FacadeBoardActions;
  // How the host brings a panel on screen. Absent, a show-panel step does
  // nothing: the panels are wherever that host already put them.
  navigation?: FacadePanelNavigation;
  // When provided, { "$state": "key" } references in configure payloads are
  // resolved against these values before $$input substitution runs.
  state?: Record<string, unknown>;
  // Who the facade is being shown to, for { "$user": … } references.
  identity?: FacadeIdentity;
  // A person set these actions off — pressed, typed, picked — so what they
  // configure is an edit to the board. False for what a facade runs by itself,
  // such as its init actions.
  byPerson?: boolean;
  // How a confirm step reaches the person. Absent where there is nobody to ask,
  // which declines: consent that could not be asked for was not given.
  ask?: AskPerson;
  // How a prompt step reaches the person. Absent where there is nobody to ask,
  // which cancels.
  askValue?: AskPersonForValue;
  // Told of each configure and process as it goes out, with the payload as
  // sent, so a facade can show what a widget sent (see sentCalls). `step` is
  // the action's position in `actions`, as for `setState`.
  onSent?: (call: {
    service: string;
    verb: SentVerb;
    payload: unknown;
    step?: number;
  }) => void;
}): Promise<void> {
  // What `$$input` stands for: the widget's value, until a prompt replaces it
  // with the person's answer.
  let input = value;

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

  // Where `actions` starts in `all`, past the steps the shorthands put first.
  const offset = all.length - (actions?.length ?? 0);
  for (const [position, act] of all.entries()) {
    const step = position >= offset ? position - offset : undefined;
    if (act.type === "configure") {
      const service = findService(boardContext, act.serviceUuid);
      if (!service) {
        continue;
      }
      const configure: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(act.configure)) {
        const withState = resolveActionRefs(v, state ?? {}, identity);
        configure[k] = applyInput(withState, input);
      }
      const target = byPerson
        ? (serviceForUserInterface(service) ?? service)
        : service;
      onSent?.({
        service: act.serviceUuid,
        verb: "configure",
        payload: configure,
        step,
      });
      await target.configure(configure);
      if (byPerson) {
        boardContext.markBoardChanged?.();
      }
    } else if (act.type === "process") {
      // Same substitution as a configure payload: what a board writes into one
      // it can write into the other.
      const withState = resolveActionRefs(act.payload ?? {}, state ?? {}, identity);
      const payload = applyInput(withState, input);
      onSent?.({ service: act.serviceUuid, verb: "process", payload, step });
      processService(boardContext, act.serviceUuid, payload);
    } else if (act.type === "set-state") {
      // A written value wins over the widget's own, and `undefined` written on
      // purpose is still a value — which is why the field's presence decides
      // rather than its content.
      setState(act.key, "value" in act ? act.value : input, step);
    } else if (act.type === "board") {
      if (act.action === "partner-board-qr") {
        boardActions?.showPartnerBoardQr();
      }
    } else if (act.type === "show-panel") {
      navigation?.showPanel(act.panel);
    } else if (act.type === "confirm") {
      const withState = resolveActionRefs(act.question, state ?? {}, identity);
      const question = applyInput(withState, input);
      if (typeof question !== "string" || !question) {
        continue;
      }
      const agreed = ask ? await ask({ ...act, question }) : false;
      if (!agreed) {
        return;
      }
    } else if (act.type === "prompt") {
      const substitute = (template: unknown) =>
        applyInput(resolveActionRefs(template, state ?? {}, identity), input);
      const question = substitute(act.question);
      const defaultValue = substitute(act.defaultValue);
      const answer = askValue
        ? await askValue({
            ...act,
            question: typeof question === "string" ? question : "",
            defaultValue,
          })
        : null;
      if (answer === null) {
        return;
      }
      input = answer;
    }
  }
}
