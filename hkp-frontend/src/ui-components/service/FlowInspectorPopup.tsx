import {
  BugPlay,
  Check,
  ChevronRight,
  Copy,
  Eraser,
  RotateCcw,
  UndoDot,
} from "lucide-react";

import Editor from "hkp-frontend/src/components/shared/Editor";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  SettingsButton,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import { isTooLarge, TooLarge } from "hkp-frontend/src/runtime/callReport";
import type { FlowRecord, FlowSide } from "./ServiceOutputPlug";
import "./flow-inspector.css";

type Props = {
  /** Which way through the service the shown values went. */
  side: FlowSide;
  history: FlowRecord[];
  /** The shown entry of `history`, 0 being the latest. */
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  /**
   * What the footer's main action does with the shown value: an output is
   * carried on downstream (Inject), an input runs the service again (Rerun).
   * Absent where that cannot be done, which disables it.
   */
  onRun?: (data: any) => void;
  /** Forgets the remembered values; the next one starts a new history. */
  onClearHistory: () => void;
  /** Whether the history list is shown, or only its heading. */
  historyExpanded: boolean;
  onToggleHistory: () => void;
};

/** The body and footer of the Flow Inspector; the frame and header are the
 *  plug's (ServiceOutputPlug), inside an element carrying `hkp-set`. */
export default function FlowInspectorPopup({
  side,
  history,
  selectedIndex,
  onSelectIndex,
  onRun,
  onClearHistory,
  historyExpanded,
  onToggleHistory,
}: Props) {
  const editor = useRef<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsDirty(false);
  }, [history[0]]);

  const selectedData = history[selectedIndex]?.data;
  // A value too large for a report to carry arrived as its description: only
  // how it began is here, so it is shown but not edited, and not run again.
  const tooLarge = isTooLarge(selectedData) ? selectedData.__hkpTooLarge : null;
  // Nothing selected — a cleared or empty history — is an empty editor: the
  // editor keeps its text when handed no value, which would leave the last
  // one standing with nothing left to inject.
  const dataAsString = useMemo(
    () =>
      tooLarge
        ? (tooLarge.preview ?? "")
        : (JSON.stringify(selectedData, null, 2) ?? ""),
    [selectedData, tooLarge],
  );
  const previews = useMemo(
    () => history.map((record) => preview(record.data)),
    [history],
  );

  const onSelect = (i: number) => {
    onSelectIndex(i);
    setIsDirty(false);
  };

  // Up and down walk the list, as in any list of choices.
  const onHistoryKey = (event: KeyboardEvent) => {
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    const next = selectedIndex + step;
    if (step && next >= 0 && next < history.length) {
      event.preventDefault();
      onSelect(next);
    }
  };

  const onResetDirty = () => {
    editor.current.setValue(dataAsString);
    setIsDirty(false);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        editor.current?.getValue() ?? dataAsString,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const onRunInternal = () => {
    if (!onRun || tooLarge) {
      return;
    }
    if (!isDirty) {
      onRun(selectedData);
    } else {
      const buffer = editor.current.getValue();
      try {
        onRun(JSON.parse(buffer));
      } catch (err) {
        console.error("FlowInspectorPopup.onRunInternal", err);
        onRun(buffer);
      }
    }
  };

  return (
    <>
      <div className="hkp-flow-body">
        {history.length > 0 && (
          <section className="hkp-set-section">
            <div className="hkp-set-section-head">
              <button
                type="button"
                className="hkp-flow-toggle"
                aria-expanded={historyExpanded}
                onClick={onToggleHistory}
              >
                <ChevronRight size={13} className="hkp-flow-chevron" />
                <span className="hkp-set-label">
                  History · {history.length}
                </span>
                {!historyExpanded && (
                  <span className="hkp-flow-latest">
                    latest {timeOf(history[0].at)}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="hkp-set-icon-btn hkp-set-icon-btn--neutral"
                aria-label="Clear history"
                title="Clear history"
                onClick={() => {
                  onClearHistory();
                  setIsDirty(false);
                }}
              >
                <Eraser size={15} />
              </button>
            </div>
            {historyExpanded && (
              <div
                className="hkp-flow-history"
                role="listbox"
                aria-label="History"
                tabIndex={0}
                onKeyDown={onHistoryKey}
              >
                {history.map((record, i) => (
                  <div
                    key={`${record.at}-${i}`}
                    role="option"
                    aria-selected={i === selectedIndex}
                    className="hkp-flow-entry"
                    title={new Date(record.at).toISOString()}
                    onClick={() => onSelect(i)}
                  >
                    <span className="hkp-flow-entry-time">
                      {timeOf(record.at)}
                    </span>
                    <span className="hkp-flow-entry-preview">
                      {previews[i]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {history.length === 0 && (
          <p className="hkp-set-hint">
            {side === "input"
              ? "Nothing received yet. A service that emits on its own — a Timer, an arriving message — receives nothing."
              : "Nothing produced yet."}
          </p>
        )}
        <SettingsSection
          label={side === "input" ? "Input" : "Output"}
          action={
            isDirty && (
              <span className="hkp-flow-edited">
                Edited
                <button
                  type="button"
                  className="hkp-set-icon-btn hkp-set-icon-btn--neutral"
                  aria-label="Revert edits"
                  title="Revert edits"
                  onClick={onResetDirty}
                >
                  <UndoDot size={15} />
                </button>
              </span>
            )
          }
        >
          {tooLarge && (
            <p className="hkp-set-hint" role="note">
              {tooLargeNote(tooLarge, side)}
            </p>
          )}
          <div className="hkp-flow-editor">
            <Editor
              ref={editor}
              value={dataAsString}
              readOnly={!!tooLarge}
              onChange={() => setIsDirty(true)}
            />
          </div>
        </SettingsSection>
      </div>
      <div className="hkp-flow-footer">
        <SettingsButton disabled={!selectedData && !isDirty} onClick={onCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </SettingsButton>
        <SettingsButton
          variant="primary"
          disabled={!onRun || !!tooLarge || (!selectedData && !isDirty)}
          title={
            side === "input"
              ? "Run this service again with this input"
              : "Carry this output on downstream"
          }
          onClick={onRunInternal}
        >
          {side === "input" ? <RotateCcw size={14} /> : <BugPlay size={14} />}
          {side === "input" ? "Rerun" : "Inject"}
        </SettingsButton>
      </div>
    </>
  );
}

/** When an output arrived, to the millisecond: a burst's items differ there. */
function timeOf(at: number): string {
  const date = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

/** What a value too large to keep is, e.g. "Text of 12.3 MiB". */
function describeTooLarge({ type, bytes, exact }: TooLarge["__hkpTooLarge"]): string {
  const kind = type === "string" ? "Text" : type === "binary" ? "Binary data" : "JSON";
  return `${kind} of ${exact ? "" : "more than "}${sizeOf(bytes)}`;
}

/** Why the inspector shows only part of a value, and what it cannot do. */
function tooLargeNote(tooLarge: TooLarge["__hkpTooLarge"], side: FlowSide): string {
  const shown =
    tooLarge.preview !== undefined
      ? "Only how it begins is shown"
      : "None of it is shown";
  const run = side === "input" ? "run again" : "carried on";
  return `${describeTooLarge(tooLarge)}: too large to keep whole. ${shown}, and it cannot be ${run} from here.`;
}

/** A size in bytes the way a person reads one. */
function sizeOf(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KiB`;
  }
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
}

/** One line of what an output is; the editor shows the whole of it. */
function preview(data: any): string {
  if (isTooLarge(data)) {
    return `${describeTooLarge(data.__hkpTooLarge)}, too large to keep`;
  }
  let text: string | undefined;
  try {
    // A sample buffer is named by its size rather than spelled out.
    text = JSON.stringify(data, (_key, value) =>
      ArrayBuffer.isView(value)
        ? `${value.constructor.name}(${(value as unknown as ArrayLike<unknown>).length ?? value.byteLength})`
        : value,
    );
  } catch {
    // Not serialisable; its plain text below says what it is.
  }
  text ??= String(data);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}
