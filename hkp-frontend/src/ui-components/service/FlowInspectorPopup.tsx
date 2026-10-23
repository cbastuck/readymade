import {
  BugPlay,
  Check,
  ChevronRight,
  Copy,
  Eraser,
  UndoDot,
} from "lucide-react";

import Editor from "hkp-frontend/src/components/shared/Editor";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  SettingsButton,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import type { OutputRecord } from "./ServiceOutputPlug";
import "./flow-inspector.css";

type Props = {
  history: OutputRecord[];
  /** The shown entry of `history`, 0 being the latest. */
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onInject: (data: any) => void;
  /** Forgets the remembered outputs; the next one starts a new history. */
  onClearHistory: () => void;
  /** Whether the history list is shown, or only its heading. */
  historyExpanded: boolean;
  onToggleHistory: () => void;
};

/** The body and footer of the Flow Inspector; the frame and header are the
 *  plug's (ServiceOutputPlug), inside an element carrying `hkp-set`. */
export default function FlowInspectorPopup({
  history,
  selectedIndex,
  onSelectIndex,
  onInject,
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
  const dataAsString = useMemo(
    () => JSON.stringify(selectedData, null, 2),
    [selectedData],
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

  const onInjectInternal = () => {
    if (!isDirty) {
      onInject(selectedData);
    } else {
      const buffer = editor.current.getValue();
      try {
        onInject(JSON.parse(buffer));
      } catch (err) {
        console.error("FlowInspectorPopup.onInjectInternal", err);
        onInject(buffer);
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
        <SettingsSection
          label="Output"
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
          <div className="hkp-flow-editor">
            <Editor
              ref={editor}
              value={dataAsString}
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
          disabled={!selectedData && !isDirty}
          onClick={onInjectInternal}
        >
          <BugPlay size={14} />
          Inject
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

/** One line of what an output is; the editor shows the whole of it. */
function preview(data: any): string {
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
