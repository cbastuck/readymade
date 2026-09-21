import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { ButtonWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useFacadeState } from "../../FacadeStateContext";
import { executeActions } from "../../executeActions";
import { useFacadeBoardActions } from "../../FacadeBoardActions";
import { usePressFeedback } from "../../pressFeedback";
import {
  StatusDot,
  statusColor,
  useNotificationValue,
} from "./StatusIndicatorRenderer";

/**
 * The question a button asks before doing what it says.
 *
 * Its own dialog rather than the browser's: a facade is the surface a person
 * uses the board through, and a native confirm is another application's
 * furniture appearing in the middle of it — mis-styled on mobile, and suppressed
 * outright by some of the hosts a board runs in, which would turn asking for
 * consent into silently acting without it.
 */
function ConfirmDialog({
  question,
  onAnswer,
}: {
  question: string | null;
  onAnswer: (agreed: boolean) => void;
}) {
  return (
    <Dialog
      open={question !== null}
      onOpenChange={(open) => {
        if (!open) {
          onAnswer(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle className="text-base font-medium leading-snug">
          {question}
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
            Keep as it is
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
            Yes, do it
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ButtonRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<ButtonWidget>) {
  const { state, setState } = useFacadeState();
  // The question currently being asked, which is also what is waiting on an
  // answer: there is nothing to run until one arrives.
  const [asking, setAsking] = useState<string | null>(null);
  const indicatorValue = useNotificationValue(
    boardContext,
    widget.indicator?.source,
  );
  const press = usePressFeedback(undefined, widget.disabled);
  const boardActions = useFacadeBoardActions();
  const run = () => {
    void executeActions({
      action: widget.action,
      actions: widget.actions,
      value: undefined,
      boardContext,
      setState,
      boardActions,
      // Without this a { "$state": … } reference in the payload travels as
      // the reference object itself, and the service receives a shape it
      // cannot read rather than the value a widget published.
      state,
      byPerson: true,
    });
  };

  return (
    <>
      <button
        {...press.handlers}
        disabled={widget.disabled}
        onClick={() => {
          // Asked before anything runs, so declining leaves the board exactly as
          // it was — no configure has been sent and no service has been asked to
          // do its job.
          if (widget.confirm) {
            setAsking(widget.confirm);
            return;
          }
          run();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 20px",
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          cursor: widget.disabled ? "default" : "pointer",
          opacity: widget.disabled ? 0.55 : 1,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "monospace",
          ...press.style,
        }}
      >
        {widget.indicator && (
          <StatusDot
            color={statusColor(indicatorValue, widget.indicator.statusColors)}
            size={8}
          />
        )}
        {widget.label}
      </button>
      <ConfirmDialog
        question={asking}
        onAnswer={(agreed) => {
          setAsking(null);
          if (agreed) {
            run();
          }
        }}
      />
    </>
  );
}
