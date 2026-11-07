import { ReactNode, useEffect, useState } from "react";
import { validateAssistBoard } from "./validation";
import { shippedBoards } from "./documentation";
import { blockUse, reviewSummary, ReviewSummary } from "./reviewSummary";
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
  connection,
}: {
  current: BoardDescriptor;
  proposed: BoardDescriptor;
  onClose: () => void;
  onApply: (board: BoardDescriptor) => Promise<boolean>;
  busy: boolean;
  error: string;
  readOnly?: boolean;
  /** Asks about addresses the edited board would contact, when it does. */
  connection?: ReactNode;
}) {
  const [draft, setDraft] = useState(() =>
    JSON.stringify(sortedJSON(proposed), null, 2),
  );
  const [validationError, setValidationError] = useState("");
  const [summary, setSummary] = useState<ReviewSummary>(() =>
    reviewSummary(current, proposed),
  );
  useEffect(() => {
    let live = true;
    void shippedBoards().then((boards) => {
      if (live) setSummary(reviewSummary(current, proposed, blockUse(boards)));
    });
    return () => {
      live = false;
    };
  }, [current, proposed]);
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
        <ReviewSummaryStrip summary={summary} />
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
        {connection}
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
              className="hkp-assist-primary"
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

/**
 * What to read first: the text written for this board, and what it is built
 * from — so the diff below is the detail, not the first thing to make sense of.
 */
function ReviewSummaryStrip({ summary }: { summary: ReviewSummary }) {
  const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;
  const changes = [
    summary.added.length && `${plural(summary.added.length, "service")} added`,
    summary.changed.length && `${plural(summary.changed.length, "service")} changed`,
    summary.removed.length && `${plural(summary.removed.length, "service")} removed`,
  ].filter(Boolean);
  return (
    <section className="hkp-assist-review" aria-label="What to review">
      <div>
        <h3>Written for this board</h3>
        <p className="hkp-assist-review-lead" data-testid="review-authored">
          {summary.authored.length
            ? `${plural(summary.authored.length, "text")}, ${plural(summary.authoredLines, "line")} — read these`
            : "Nothing written; only blocks and their settings"}
        </p>
        <ul>
          {summary.authored.map((text, i) => (
            <li key={i}>
              {text.service} · {text.field} · {plural(text.lines, "line")}
            </li>
          ))}
        </ul>
        {changes.length > 0 && <p className="hkp-assist-hint">{changes.join(" · ")}</p>}
      </div>
      <div>
        <h3>Built from</h3>
        <ul data-testid="review-blocks">
          {summary.blocks.map((block) => (
            <li key={`${block.kind}:${block.id}`}>
              <strong>{block.id}</strong> {block.kind}
              {block.boards > 0 && (
                <span className="hkp-assist-hint">
                  {" "}
                  · in {plural(block.boards, "shipped board")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
