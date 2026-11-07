import { CSSProperties, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { copyToClipboard } from "../../../clipboard";
import { isTooLarge } from "../../../runtime/callReport";
import {
  FlowSide,
  editedValue,
  flowText,
  previewFlow,
  timeOf,
  tooLargeNote,
} from "../../../ui-components/service/flowRecords";
import { BoardFlowContext, useServiceFlow } from "./boardFlow";
import { useCaptureControl } from "./capture";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";

/**
 * What a service received and passed on, in its sheet: the desktop's Flow
 * Inspector (`FlowInspectorPopup`) in the mobile style.
 *
 * The values come from the board's flow (`boardFlow`), kept since the board was
 * shown, so opening the sheet shows what already happened. Without Capture mode
 * a run reports only that it happened; the inspector says so, and offers to
 * turn it on, in the words of the desktop's dialog.
 */

type Props = {
  runtimeId: string;
  serviceUuid: string;
  /** Runs the service again with an input; absent where its runtime cannot. */
  onRerun?: (input: any) => void;
  /** Carries an output on downstream, as if the service had produced it. */
  onInject?: (output: any) => void;
};

export default function MobileFlowInspector({
  runtimeId,
  serviceUuid,
  onRerun,
  onInject,
}: Props) {
  const flow = useContext(BoardFlowContext);
  const { input, output } = useServiceFlow(runtimeId, serviceUuid);
  const capture = useCaptureControl();
  // What the service produced, unless asked for what it received.
  const [side, setSide] = useState<FlowSide>("output");
  const [selected, setSelected] = useState({ input: 0, output: 0 });
  // What the editor holds once edited; null while it shows the value as it is.
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const history = side === "input" ? input : output;
  const index = selected[side];
  const record = history[index];

  // A new value is the one shown on its side.
  const latestIn = input[0];
  const latestOut = output[0];
  useEffect(() => {
    setSelected((s) => ({ ...s, input: 0 }));
  }, [latestIn]);
  useEffect(() => {
    setSelected((s) => ({ ...s, output: 0 }));
  }, [latestOut]);
  // An edit belongs to the value it was made to.
  useEffect(() => {
    setDraft(null);
  }, [record, side]);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const data = record?.data;
  // A value too large for a report to carry arrived as its description: only
  // how it began is here, so it is shown but not edited, and not run again.
  const tooLarge = isTooLarge(data) ? data.__hkpTooLarge : null;
  const text = useMemo(() => flowText(data), [data]);
  const previews = useMemo(
    () => history.map((each) => previewFlow(each.data)),
    [history],
  );
  const shown = draft ?? text;
  const onRun = side === "input" ? onRerun : onInject;
  const canRun = !!onRun && !tooLarge && (record !== undefined || draft !== null);

  const run = () => {
    if (!onRun || !canRun) {
      return;
    }
    onRun(draft === null ? data : editedValue(draft));
    toast.success(side === "input" ? "Running it again" : "Carried on");
  };

  const copy = async () => {
    if (await copyToClipboard(shown)) {
      setCopied(true);
    } else {
      toast.error("Could not copy the value");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!capture.on && (
        <div
          role="note"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${M.border}`,
            background: "#f8f5f2",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: 1.45, color: M.textSecondary }}>
            Capture mode is off, so the inspector shows that this service ran,
            but not what it received or passed on. Turn Capture mode on? It
            takes effect from the next run.
          </div>
          <button
            onClick={() => capture.set(true)}
            disabled={capture.busy}
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 14px",
              border: "none",
              borderRadius: 9,
              background: M.danger,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: capture.busy ? "default" : "pointer",
              opacity: capture.busy ? 0.5 : 1,
            }}
          >
            <MobileIcon name="record" size={13} color="#fff" style={{ fill: "#fff" }} />
            Turn on Capture mode
          </button>
        </div>
      )}

      {/* Which way through the service */}
      <div
        role="group"
        aria-label="Side"
        style={{
          display: "flex",
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 10,
          padding: 3,
          gap: 2,
        }}
      >
        {(["input", "output"] as const).map((each) => {
          const active = side === each;
          const count = (each === "input" ? input : output).length;
          return (
            <button
              key={each}
              aria-pressed={active}
              onClick={() => setSide(each)}
              style={{
                flex: 1,
                height: 34,
                border: "none",
                borderRadius: 8,
                background: active ? M.teal : "transparent",
                color: active ? "#fff" : M.textSecondary,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {each === "input" ? "Input" : "Output"}
              {count > 0 && ` · ${count}`}
            </button>
          );
        })}
      </div>

      {history.length === 0 ? (
        <div style={{ fontSize: 13, lineHeight: 1.45, color: M.textMuted, padding: "0 4px" }}>
          {side === "input"
            ? "Nothing received yet. A service that emits on its own — a Timer, an arriving message — receives nothing."
            : "Nothing produced yet."}
        </div>
      ) : (
        <div>
          <div style={sectionHeadStyle}>
            <span style={labelStyle}>History</span>
            <button
              onClick={() => flow?.clear(runtimeId, serviceUuid, side)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                background: "none",
                padding: "2px 4px",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: M.textSecondary,
                cursor: "pointer",
              }}
            >
              <MobileIcon name="eraser" size={13} color={M.textSecondary} />
              Clear
            </button>
          </div>
          <div
            role="listbox"
            aria-label="History"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              background: M.border,
              border: `1px solid ${M.border}`,
              borderRadius: 12,
              overflow: "hidden",
              maxHeight: 196,
              overflowY: "auto",
            }}
          >
            {history.map((each, i) => (
              <button
                key={`${each.at}-${i}`}
                role="option"
                aria-selected={i === index}
                onClick={() => setSelected((s) => ({ ...s, [side]: i }))}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "9px 12px",
                  border: "none",
                  background: i === index ? M.tealLight : M.card,
                  textAlign: "left",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11.5,
                    color: i === index ? M.tealDark : M.textMuted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {timeOf(each.at)}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: M.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {previews[i]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={sectionHeadStyle}>
          <span style={labelStyle}>{side === "input" ? "Input" : "Output"}</span>
          {draft !== null && (
            <button
              onClick={() => setDraft(null)}
              style={{
                border: "none",
                background: "none",
                padding: "2px 4px",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: M.tealDark,
                cursor: "pointer",
              }}
            >
              Edited · Revert
            </button>
          )}
        </div>
        {tooLarge && (
          <div
            role="note"
            style={{ fontSize: 12, lineHeight: 1.45, color: M.textSecondary, marginBottom: 8 }}
          >
            {tooLargeNote(tooLarge, side)}
          </div>
        )}
        <textarea
          aria-label={side === "input" ? "Input value" : "Output value"}
          value={shown}
          readOnly={!!tooLarge}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: 160,
            padding: "10px 12px",
            border: `1px solid ${M.border}`,
            borderRadius: 10,
            background: "#f8f5f2",
            fontFamily: "monospace",
            // Below 16px iOS zooms into a focused field and stays zoomed.
            fontSize: 16,
            lineHeight: 1.4,
            color: M.textPrimary,
            resize: "vertical",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void copy()}
          disabled={record === undefined && draft === null}
          style={{
            ...footerButtonStyle,
            border: `1.5px solid ${M.border}`,
            background: M.card,
            color: M.textSecondary,
            opacity: record === undefined && draft === null ? 0.45 : 1,
          }}
        >
          <MobileIcon name={copied ? "check" : "copy"} size={15} color={M.textSecondary} />
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={run}
          disabled={!canRun}
          style={{
            ...footerButtonStyle,
            border: "none",
            background: M.teal,
            color: "#fff",
            opacity: canRun ? 1 : 0.45,
          }}
        >
          <MobileIcon
            name={side === "input" ? "rotateCcw" : "send"}
            size={15}
            color="#fff"
          />
          {side === "input" ? "Rerun" : "Inject"}
        </button>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: M.textMuted, padding: "0 4px" }}>
        {side === "input"
          ? "Rerun runs this service again with this input, and what follows it."
          : "Inject carries this output on to the services after this one."}
      </div>
    </div>
  );
}

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: M.textMuted,
  textTransform: "uppercase",
};

const footerButtonStyle: CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
