import { BugPlay, Check, Copy, UndoDot } from "lucide-react";

import Editor from "hkp-frontend/src/components/shared/Editor";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SettingsButton,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import "./flow-inspector.css";

type Props = {
  history: any[];
  /** The shown entry of `history`, 0 being the latest. */
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onInject: (data: any) => void;
};

/** The body and footer of the Flow Inspector; the frame and header are the
 *  plug's (ServiceOutputPlug), inside an element carrying `hkp-set`. */
export default function FlowInspectorPopup({
  history,
  selectedIndex,
  onSelectIndex,
  onInject,
}: Props) {
  const editor = useRef<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsDirty(false);
  }, [history[0]]);

  const selectedData = history[selectedIndex];
  const dataAsString = useMemo(
    () => JSON.stringify(selectedData, null, 2),
    [selectedData],
  );

  const onSelect = (i: number) => {
    onSelectIndex(i);
    setIsDirty(false);
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
        {history.length > 1 && (
          <SettingsSection label="History">
            <div className="hkp-flow-history">
              {history.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className="hkp-flow-chip"
                  aria-pressed={i === selectedIndex}
                  title={i === 0 ? "Latest output" : `${i} outputs ago`}
                  onClick={() => onSelect(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </SettingsSection>
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
