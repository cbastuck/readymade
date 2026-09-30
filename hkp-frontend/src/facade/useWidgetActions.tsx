import { ReactNode, useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import {
  ConfirmAction,
  FacadeWidgetAction,
  PromptAction,
  WidgetAction,
} from "./types";
import { useFacadeState } from "./FacadeStateContext";
import { executeActions } from "./executeActions";
import { useFacadeBoardActions } from "./FacadeBoardActions";

/** A value as the text a field starts with. */
function asText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const buttonStyle = {
  padding: "8px 16px",
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  cursor: "pointer",
  fontSize: 13,
} as const;

/**
 * The question a confirm or a prompt step asks.
 *
 * Its own dialog rather than the browser's: a facade is the surface a person
 * uses the board through, and a native confirm is another application's
 * furniture appearing in the middle of it — mis-styled on mobile, and suppressed
 * outright by some of the hosts a board runs in, which would turn asking for
 * consent into silently acting without it.
 *
 * A confirm is answered yes or no; a prompt with what is in its field, or
 * cancelled.
 */
function QuestionDialog({
  step,
  onAnswer,
}: {
  step: ConfirmAction | PromptAction | null;
  onAnswer: (answer: boolean | string | null) => void;
}) {
  const prompt = step?.type === "prompt" ? step : null;
  const [text, setText] = useState("");
  useEffect(() => {
    setText(asText(prompt?.defaultValue));
  }, [prompt]);

  const decline = () => onAnswer(prompt ? null : false);
  const agree = () => onAnswer(prompt ? text : true);

  const field = {
    value: text,
    autoFocus: true,
    "aria-label": prompt?.question,
    // 16px and up: iOS zooms into a smaller field on focus, and stays there.
    style: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 8,
      border: "1px solid hsl(var(--border))",
      background: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      fontSize: 16,
      fontFamily: "var(--font-mono, monospace)",
    },
  };

  return (
    <Dialog
      open={step !== null}
      onOpenChange={(open) => {
        if (!open) {
          decline();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle className="text-base font-medium leading-snug">
          {step?.question}
        </DialogTitle>
        {prompt ? (
          prompt.multiline ? (
            <textarea
              {...field}
              rows={5}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <input
              {...field}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agree();
                }
              }}
            />
          )
        ) : null}
        <DialogFooter>
          <button
            onClick={decline}
            style={{
              ...buttonStyle,
              borderColor: "hsl(var(--border))",
              backgroundColor: "hsl(var(--muted))",
              color: "hsl(var(--foreground))",
            }}
          >
            {step?.decline || (prompt ? "Cancel" : "Keep as it is")}
          </button>
          <button
            onClick={agree}
            style={{
              ...buttonStyle,
              borderColor: "transparent",
              backgroundColor: "var(--hkp-accent, hsl(var(--primary)))",
              color: "hsl(var(--primary-foreground))",
              fontWeight: 500,
            }}
          >
            {step?.agree || (prompt ? "Save" : "Yes, do it")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Pending = {
  step: ConfirmAction | PromptAction;
  answer: (answer: boolean | string | null) => void;
};

/**
 * Runs what a widget does when a person uses it, and shows whatever the steps
 * have to ask them on the way.
 *
 * The asking lives with the widget rather than with the host showing the
 * facade, so a widget rendered anywhere — a panel, a preview, a test — can hold
 * a step that waits on the person. Render `prompt` next to the widget.
 */
export function useWidgetActions(boardContext: BoardContextState): {
  run: (what: {
    action?: FacadeWidgetAction;
    actions?: WidgetAction[];
    confirm?: string;
    value?: unknown;
  }) => Promise<void>;
  prompt: ReactNode;
} {
  const { state, setState } = useFacadeState();
  const boardActions = useFacadeBoardActions();
  const [pending, setPending] = useState<Pending | null>(null);
  // The question on screen, read when a new one arrives: only one is shown at
  // a time, and one that is replaced before it is answered counts as declined.
  const pendingRef = useRef<Pending | null>(null);

  /**
   * Shows a step and resolves with its answer. A step still on screen when
   * another arrives is answered as declined — false for a confirm, null for a
   * prompt — which is what each dialog's decline button would have said.
   */
  const put = (step: ConfirmAction | PromptAction) =>
    new Promise<boolean | string | null>((resolve) => {
      const shown = pendingRef.current;
      shown?.answer(shown.step.type === "prompt" ? null : false);
      const next: Pending = {
        step,
        answer: (answer) => {
          if (pendingRef.current === next) {
            pendingRef.current = null;
            setPending(null);
          }
          resolve(answer);
        },
      };
      pendingRef.current = next;
      setPending(next);
    });

  const ask = async (step: ConfirmAction) => (await put(step)) === true;

  const askValue = async (step: PromptAction) => {
    const answer = await put(step);
    return typeof answer === "string" ? answer : null;
  };

  const run = ({
    action,
    actions,
    confirm,
    value,
  }: {
    action?: FacadeWidgetAction;
    actions?: WidgetAction[];
    confirm?: string;
    value?: unknown;
  }) =>
    executeActions({
      action,
      actions,
      confirm,
      value,
      boardContext,
      setState,
      boardActions,
      // Without this a { "$state": … } reference in the payload travels as
      // the reference object itself, and the service receives a shape it
      // cannot read rather than the value a widget published.
      state,
      byPerson: true,
      ask,
      askValue,
    });

  return {
    run,
    prompt: (
      <QuestionDialog
        step={pending?.step ?? null}
        onAnswer={(answer) => pending?.answer(answer)}
      />
    ),
  };
}
