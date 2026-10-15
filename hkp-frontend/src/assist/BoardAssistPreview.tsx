import { useState } from "react";
import { validateAssistBoard } from "./validation";
import { BoardDescriptor } from "../types";
import { DiffEditor } from "../components/shared/Editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui-components/primitives/dialog";

// Object property order has no meaning in board JSON; array order is wiring.
// Keep the real values (including runtime state) while avoiding noisy diffs
// caused by the model writing the same properties in a different order.
function sortedJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJSON);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortedJSON(record[key])]),
  );
}

export default function BoardAssistPreview({
  current,
  proposed,
  onClose,
  onApply,
  busy,
  error,
  readOnly = false,
}: {
  current: BoardDescriptor;
  proposed: BoardDescriptor;
  onClose: () => void;
  onApply: (board: BoardDescriptor) => Promise<boolean>;
  busy: boolean;
  error: string;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(() =>
    JSON.stringify(sortedJSON(proposed), null, 2),
  );
  const [validationError, setValidationError] = useState("");
  const applyDraft = async () => {
    setValidationError("");
    let board: BoardDescriptor;
    try {
      board = validateAssistBoard(JSON.parse(draft));
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : "Enter a valid board configuration.",
      );
      return;
    }
    if (await onApply(board)) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="hkp-assist-preview"
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(1200px, 96vw)",
          maxWidth: "none",
          height: "min(800px, 90vh)",
          padding: 20,
          gap: 12,
          overflow: "hidden",
          background: "var(--bg-app, #fafafa)",
          color: "var(--text, #1a1a1a)",
        }}
      >
        <DialogTitle>Review board changes</DialogTitle>
        <DialogDescription>
          {readOnly
            ? "These changes have already been applied. Compare the previous board with the applied board."
            : "Edit the proposed configuration on the right, then apply it. The current board on the left stays read-only."}
        </DialogDescription>
        <div className="hkp-assist-diff-labels">
          <span>
            {readOnly ? "Previous board" : "Current board"} · removed lines in
            red
          </span>
          <span>
            {readOnly ? "Applied board" : "Proposed board"} · added lines in
            green
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <DiffEditor
            original={JSON.stringify(sortedJSON(current), null, 2)}
            modified={draft}
            readOnly={readOnly || busy}
            onChange={
              readOnly
                ? undefined
                : (value) => {
                    setDraft(value);
                    setValidationError("");
                  }
            }
          />
        </div>
        {(validationError || error) && (
          <p role="alert" className="hkp-assist-error">
            {validationError || error}
          </p>
        )}
        <div className="hkp-assist-preview-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyDraft()}
            >
              {busy ? "Applying…" : "Apply edited board"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
