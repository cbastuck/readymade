import { ReactNode, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { ConfirmAction, FacadeWidgetAction, WidgetAction } from "./types";
import { useFacadeState } from "./FacadeStateContext";
import { executeActions } from "./executeActions";
import { useFacadeBoardActions } from "./FacadeBoardActions";

/**
 * The question a confirm step asks.
 *
 * Its own dialog rather than the browser's: a facade is the surface a person
 * uses the board through, and a native confirm is another application's
 * furniture appearing in the middle of it — mis-styled on mobile, and suppressed
 * outright by some of the hosts a board runs in, which would turn asking for
 * consent into silently acting without it.
 */
function ConfirmDialog({
  step,
  onAnswer,
}: {
  step: ConfirmAction | null;
  onAnswer: (agreed: boolean) => void;
}) {
  return (
    <Dialog
      open={step !== null}
      onOpenChange={(open) => {
        if (!open) {
          onAnswer(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle className="text-base font-medium leading-snug">
          {step?.question}
        </DialogTitle>
        <DialogFooter>
          <button
            onClick={() => onAnswer(false)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "hsl(var(--border))",
              backgroundColor: "hsl(var(--muted))",
              color: "hsl(var(--foreground))",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {step?.decline || "Keep as it is"}
          </button>
          <button
            onClick={() => onAnswer(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "transparent",
              backgroundColor: "var(--hkp-accent, hsl(var(--primary)))",
              color: "hsl(var(--primary-foreground))",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {step?.agree || "Yes, do it"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Pending = {
  step: ConfirmAction;
  answer: (agreed: boolean) => void;
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

  const ask = (step: ConfirmAction) =>
    new Promise<boolean>((resolve) => {
      pendingRef.current?.answer(false);
      const next: Pending = {
        step,
        answer: (agreed) => {
          if (pendingRef.current === next) {
            pendingRef.current = null;
            setPending(null);
          }
          resolve(agreed);
        },
      };
      pendingRef.current = next;
      setPending(next);
    });

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
    });

  return {
    run,
    prompt: (
      <ConfirmDialog
        step={pending?.step ?? null}
        onAnswer={(agreed) => pending?.answer(agreed)}
      />
    ),
  };
}
