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
import { isTooLarge } from "hkp-frontend/src/runtime/callReport";
import {
  editedValue,
  flowText,
  previewFlow,
  timeOf,
  tooLargeNote,
  type FlowRecord,
  type FlowSide,
} from "./flowRecords";
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
  const dataAsString = useMemo(() => flowText(selectedData), [selectedData]);
  const previews = useMemo(
    () => history.map((record) => previewFlow(record.data)),
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
      onRun(editedValue(editor.current.getValue()));
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
