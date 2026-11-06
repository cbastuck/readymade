import { useMemo, useState, type CSSProperties } from "react";

import AssistConnectionNotice from "../../assist/AssistConnectionNotice";
import {
  boardText,
  describeProposal,
  diffHunks,
  lineDiff,
  type DiffLine,
} from "../../assist/proposalDiff";
import type { BoardAssist } from "../../assist/useBoardAssist";
import MobilePage from "../playground/mobile/MobilePage";
import { M } from "../playground/mobile/tokens";
import { button, sectionLabel } from "./mobileAssistStyles";

const LINE: Record<DiffLine["kind"], CSSProperties> = {
  same: { color: M.textSecondary },
  added: { background: "#e5f6ea", color: "#14532d" },
  removed: { background: "#fdeaea", color: "#7f1d1d" },
};
const MARK: Record<DiffLine["kind"], string> = { same: " ", added: "+", removed: "−" };

type Props = {
  assist: BoardAssist;
  zIndex?: number;
};

/**
 * A proposal, before it is applied or after: what it does in words, then the
 * board document's lines that differ, with the unchanged ones folded. Read
 * only — a proposal is changed by asking for another, which on a phone is
 * easier than editing JSON.
 */
export default function MobileAssistPreview({ assist, zIndex = 62 }: Props) {
  const { preview, busy, error, pendingConnection } = assist;
  const [unfolded, setUnfolded] = useState<Set<number>>(new Set());
  const { said, hunks, added, removed } = useMemo(() => {
    if (!preview) return { said: [], hunks: [], added: 0, removed: 0 };
    const lines = lineDiff(boardText(preview.current), boardText(preview.proposed));
    return {
      said: describeProposal(preview.current, preview.proposed),
      hunks: diffHunks(lines),
      added: lines.filter((line) => line.kind === "added").length,
      removed: lines.filter((line) => line.kind === "removed").length,
    };
  }, [preview]);
  if (!preview) return null;
  const close = () => {
    if (!busy) assist.closePreview();
  };
  const apply = async () => {
    if (await assist.applyPreview(preview.proposed)) assist.closePreview();
  };
  return (
    <MobilePage title="Review changes" onBack={close} zIndex={zIndex}>
      <p style={{ margin: "0 4px", fontSize: 14, color: M.textSecondary, lineHeight: 1.45 }}>
        {preview.readOnly
          ? "Already applied. This is the board before the proposal against the board it made."
          : "Nothing changes until you apply. Ask for another proposal to change this one."}
      </p>

      <div style={sectionLabel}>What it does</div>
      <div
        style={{
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 12,
          padding: "10px 14px",
        }}
      >
        {said.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
            {said.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 14, color: M.textSecondary }}>
            No change to the board's runtimes, services or other parts.
          </span>
        )}
      </div>

      <div style={sectionLabel}>
        Lines · <span style={{ color: "#15803d" }}>+{added}</span>{" "}
        <span style={{ color: M.danger }}>−{removed}</span>
      </div>
      <div
        aria-label="Changed lines"
        style={{
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 12,
          overflow: "hidden",
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 11.5,
          lineHeight: 1.5,
        }}
      >
        {hunks.map((hunk, index) =>
          hunk.kind === "folded" && !unfolded.has(index) ? (
            <button
              key={index}
              type="button"
              onClick={() => setUnfolded((current) => new Set(current).add(index))}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 12px",
                border: "none",
                borderTop: index ? `1px solid ${M.border}` : "none",
                borderBottom: `1px solid ${M.border}`,
                background: M.bg,
                color: M.textMuted,
                fontFamily: "inherit",
                fontSize: "inherit",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              ⋯ {hunk.lines.length} unchanged line{hunk.lines.length === 1 ? "" : "s"}
            </button>
          ) : (
            <div key={index}>
              {hunk.lines.map(
                (line, i) => (
                  <div
                    key={i}
                    data-kind={line.kind}
                    style={{
                      ...LINE[line.kind],
                      padding: "0 12px",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <span aria-hidden="true" style={{ userSelect: "none", opacity: 0.6 }}>
                      {MARK[line.kind]}{" "}
                    </span>
                    {line.text}
                  </div>
                ),
              )}
            </div>
          ),
        )}
      </div>

      <div
        className="hkp-assist-mobile"
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 16,
          paddingTop: 12,
          background: M.bg,
        }}
      >
        {pendingConnection?.index === preview.index && (
          <AssistConnectionNotice
            addresses={pendingConnection.addresses}
            busy={busy}
            onAccept={() => void assist.acceptConnection()}
            onCancel={assist.cancelConnection}
          />
        )}
        {error && (
          <p role="alert" style={{ margin: "0 4px 10px", fontSize: 13, color: M.danger }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" disabled={busy} onClick={close} style={button("plain", !busy)}>
            {preview.readOnly ? "Close" : "Discard"}
          </button>
          {!preview.readOnly && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply()}
              style={button("primary", !busy)}
            >
              {busy ? "Applying…" : "Apply changes"}
            </button>
          )}
        </div>
      </div>
    </MobilePage>
  );
}
