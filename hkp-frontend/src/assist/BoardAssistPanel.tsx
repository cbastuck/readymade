import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { useBoardContext } from "../BoardContext";
import { useSelection } from "../selection/SelectionContext";
import SettingsDialog from "../ui-components/SettingsDialog";
import ReadymadeMark from "../components/Toolbar/assets/hkp-single-dot-h.svg?react";
import { Effort } from "./settings";
import BoardAssistPrompt from "./BoardAssistPrompt";
import BoardAssistPromptResizer, {
  BOARD_ASSIST_DEFAULT_PROMPT_HEIGHT,
  BOARD_ASSIST_MAX_PROMPT_HEIGHT,
  BOARD_ASSIST_PROMPT_HEIGHT_KEY,
  clampBoardAssistPromptHeight,
} from "./BoardAssistPromptResizer";
import BoardAssistPreview from "./BoardAssistPreview";
import { unencryptedRemote } from "./addresses";
import AssistConnectionNotice from "./AssistConnectionNotice";
import BoardAssistResizer, {
  BOARD_ASSIST_DEFAULT_WIDTH,
  BOARD_ASSIST_WIDTH_KEY,
  clampBoardAssistWidth,
} from "./BoardAssistResizer";
import { useBoardAssist } from "./useBoardAssist";
import "./assist.css";

export default function BoardAssistPanel({
  visible,
  onClose,
  host,
}: {
  visible: boolean;
  onClose: () => void;
  host: HTMLElement | null;
}) {
  const board = useBoardContext();
  const selection = useSelection();
  const assist = useBoardAssist({
    active: visible,
    focus: {
      runtimeId: selection?.selectedRuntimeId,
      serviceUuids: selection?.selectedServices?.uuids ?? [],
    },
  });
  const {
    settings,
    compatible,
    providerReady,
    models,
    modelsLoading,
    model,
    efforts,
    effort,
    updateSettings,
    entries,
    prompt,
    scope,
    busy,
    status,
    error,
    preview,
    pendingConnection,
    confirmRevert,
    selectedRuntime,
    selectedCount,
  } = assist;
  const [promptHeight, setPromptHeight] = useState(() => {
    const stored = Number(localStorage.getItem(BOARD_ASSIST_PROMPT_HEIGHT_KEY));
    return clampBoardAssistPromptHeight(
      stored > 0 ? stored : BOARD_ASSIST_DEFAULT_PROMPT_HEIGHT,
    );
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = Number(localStorage.getItem(BOARD_ASSIST_WIDTH_KEY));
    return clampBoardAssistWidth(
      stored > 0 ? stored : BOARD_ASSIST_DEFAULT_WIDTH,
    );
  });
  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) threadEnd.current?.scrollIntoView?.({ block: "end" });
  }, [entries, status, visible]);

  if (!host) return null;
  return createPortal(
    <>
      <aside
        id="board-ai-assist"
        className="hkp-assist"
        aria-label="Board Assist"
        hidden={!visible}
        style={
          {
            "--hkp-assist-width": `${panelWidth}px`,
          } as React.CSSProperties
        }
      >
        <BoardAssistResizer
          width={panelWidth}
          onResize={setPanelWidth}
          onCommit={(width) =>
            localStorage.setItem(BOARD_ASSIST_WIDTH_KEY, String(width))
          }
          onReset={() => {
            setPanelWidth(BOARD_ASSIST_DEFAULT_WIDTH);
            localStorage.removeItem(BOARD_ASSIST_WIDTH_KEY);
          }}
        />
        <header>
          <span>Board Assist</span>
          <button
            type="button"
            className="hkp-assist-icon-btn"
            aria-label="Close Board Assist"
            title="Close Board Assist"
            onClick={onClose}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </header>
        <div className="hkp-assist-controls">
          <details className="hkp-assist-model-settings">
            <summary>
              <span>
                <strong>Model settings</strong>
                <small>
                  {compatible ? "OpenAI compatible" : "Anthropic"}
                  {model ? ` · ${model.display_name}` : ""}
                  {` · ${
                    compatible
                      ? settings.openAIThinking === "default"
                        ? "Server default"
                        : `Thinking ${settings.openAIThinking}`
                      : effort === "default"
                        ? "Model default"
                        : `${effort} effort`
                  }`}
                </small>
              </span>
              <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className="hkp-assist-model-settings-content">
              <label>
                Provider{" "}
                <select
                  disabled={busy}
                  value={settings.provider}
                  onChange={(event) =>
                    updateSettings({
                      provider: event.target.value as typeof settings.provider,
                      model: "",
                    })
                  }
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai-compatible">OpenAI compatible</option>
                </select>
              </label>
              <label>
                Model{" "}
                <select
                  disabled={busy || modelsLoading || !models.length}
                  value={model?.id ?? ""}
                  onChange={(event) =>
                    updateSettings({ model: event.target.value })
                  }
                >
                  {!models.length && (
                    <option value="">
                      {modelsLoading
                        ? "Querying models…"
                        : compatible
                          ? "Configure an API server"
                          : "Enter an Anthropic token"}
                    </option>
                  )}
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hkp-assist-row">
                <label>
                  Effort{" "}
                  <select
                    disabled={busy || (!compatible && efforts.length === 1)}
                    value={compatible ? settings.openAIThinking : effort}
                    onChange={(event) =>
                      updateSettings(
                        compatible
                          ? {
                              openAIThinking: event.target
                                .value as typeof settings.openAIThinking,
                            }
                          : { effort: event.target.value as Effort },
                      )
                    }
                  >
                    {compatible ? (
                      <>
                        <option value="default">Server default</option>
                        <option value="off">Thinking off</option>
                        <option value="on">Thinking on</option>
                      </>
                    ) : (
                      efforts.map((level) => (
                        <option key={level} value={level}>
                          {level === "default" ? "Model default" : level}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || modelsLoading || !providerReady}
                  onClick={assist.refreshModels}
                >
                  Refresh models
                </button>
              </div>
            </div>
          </details>
          <label className="hkp-assist-context">
            Context{" "}
            <select
              disabled={busy}
              value={scope}
              onChange={(event) => assist.setScope(event.target.value)}
            >
              <option value="board">Whole board</option>
              <option value="selection">
                {selectedRuntime
                  ? `Only runtime ${selectedRuntime.name}${
                      selectedCount
                        ? ` · ${selectedCount} selected service${selectedCount === 1 ? "" : "s"}`
                        : ""
                    }`
                  : "Whole board (nothing selected)"}
              </option>
            </select>
          </label>
          <label className="hkp-assist-check">
            <input
              type="checkbox"
              disabled={busy}
              checked={settings.includeAssetContents}
              onChange={(event) =>
                updateSettings({ includeAssetContents: event.target.checked })
              }
            />
            Include asset contents
          </label>
        </div>
        <div
          ref={thread}
          className="hkp-assist-thread"
          role="log"
          aria-label="Board Assist conversation"
          aria-live="polite"
        >
          {!entries.length && (
            <div className="hkp-assist-empty" aria-label="Readymade">
              <ReadymadeMark aria-hidden="true" />
            </div>
          )}
          {entries.map((entry, index) => (
            <article
              key={index}
              className={`hkp-assist-message hkp-assist-${entry.role}`}
            >
              <strong>{entry.role === "user" ? "You" : "Assistant"}</strong>
              <p>{entry.text}</p>
              {entry.rawResponse !== undefined && (
                <details>
                  <summary>Show raw model response</summary>
                  <pre>{entry.rawResponse || "(Empty response)"}</pre>
                </details>
              )}
              {entry.board && (
                <>
                  <p
                    className={
                      entry.preflightError
                        ? "hkp-assist-error"
                        : "hkp-assist-hint"
                    }
                    role={entry.preflightError ? "alert" : undefined}
                  >
                    {entry.preflightError
                      ? `Preflight failed: ${entry.preflightError}`
                      : entry.preflightPassed
                        ? "Preflight passed. Review before applying."
                        : "Review before applying."}
                  </p>
                  {pendingConnection?.index === index && !preview && (
                    <AssistConnectionNotice
                      addresses={pendingConnection.addresses}
                      busy={busy}
                      onAccept={() =>
                        void assist.acceptConnection()
                      }
                      onCancel={assist.cancelConnection}
                    />
                  )}
                  {confirmRevert === index && (
                    <div className="hkp-assist-confirm" role="alert">
                      <p>
                        The board changed after this proposal was applied.
                        Reverting restores the board from before the proposal
                        and discards those later changes.
                      </p>
                      <div className="hkp-assist-row">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={assist.keepCurrentBoard}
                        >
                          Keep current board
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void assist.revert(index, true)}
                        >
                          Revert anyway
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="hkp-assist-row">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void assist.previewChanges(entry, index)}
                    >
                      Show changes
                    </button>
                    {assist.revertible(index) ? (
                      <button
                        type="button"
                        disabled={busy || !assist.canRevert}
                        onClick={() => void assist.revert(index)}
                      >
                        Revert
                      </button>
                    ) : (
                      !entry.applied && (
                        <button
                          type="button"
                          disabled={busy || !!entry.preflightError}
                          onClick={() => void assist.apply(entry, index)}
                        >
                          Apply board
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
          {status && (
            <p role="status" className="hkp-assist-hint">
              {status}
            </p>
          )}
          {assist.knowledgeNotice && (
            <p role="status" className="hkp-assist-hint">
              {assist.knowledgeNotice}
            </p>
          )}
          <div ref={threadEnd} />
        </div>
        <BoardAssistPromptResizer
          height={promptHeight}
          maximumHeightOf={() => {
            const conversationHeight =
              thread.current?.getBoundingClientRect().height ?? 0;
            // Keep a useful conversation viewport above the prompt. JSDOM and
            // a not-yet-laid-out panel report zero, where the hard cap is best.
            return conversationHeight > 0
              ? promptHeight + conversationHeight - 120
              : BOARD_ASSIST_MAX_PROMPT_HEIGHT;
          }}
          onResize={setPromptHeight}
          onCommit={(height) =>
            localStorage.setItem(
              BOARD_ASSIST_PROMPT_HEIGHT_KEY,
              String(height),
            )
          }
          onReset={() => {
            setPromptHeight(BOARD_ASSIST_DEFAULT_PROMPT_HEIGHT);
            localStorage.removeItem(BOARD_ASSIST_PROMPT_HEIGHT_KEY);
          }}
        />
        {error && (
          <p role="alert" className="hkp-assist-error">
            {error}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void assist.send();
          }}
        >
          <BoardAssistPrompt
            board={board}
            value={prompt}
            disabled={busy}
            height={promptHeight}
            onChange={assist.setPrompt}
            onSubmit={() => void assist.send()}
          />
          <div className="hkp-assist-row">
            <button
              type="button"
              disabled={busy || !entries.length}
              onClick={assist.newConversation}
            >
              New conversation
            </button>
            {busy ? (
              <button
                type="button"
                onClick={assist.stop}
                disabled={!assist.stoppable}
              >
                Stop
              </button>
            ) : !providerReady ? (
              <button type="button" onClick={() => setSettingsTab("ai-assist")}>
                API settings
              </button>
            ) : (
              <button
                type="submit"
                className="hkp-assist-primary"
                disabled={!prompt.trim() || !model || !providerReady}
              >
                Send
              </button>
            )}
          </div>
          <p className="hkp-assist-hint">
            {assist.disclosure}
          </p>
          {compatible && unencryptedRemote(settings.openAICompatibleUrl) && (
            <p className="hkp-assist-error" role="alert">
              This server is reached over unencrypted HTTP on another machine.
              Your token, prompts and board can be read on the way.
            </p>
          )}
        </form>
      </aside>
      {preview && (
        <BoardAssistPreview
          current={preview.current}
          proposed={preview.proposed}
          onClose={assist.closePreview}
          onApply={assist.applyPreview}
          connection={
            pendingConnection?.index === preview.index ? (
              <AssistConnectionNotice
                addresses={pendingConnection.addresses}
                busy={busy}
                onAccept={() => void assist.acceptConnection()}
                onCancel={assist.cancelConnection}
              />
            ) : null
          }
          busy={busy}
          error={error}
          readOnly={preview.readOnly}
        />
      )}
      <SettingsDialog tab={settingsTab} onChangeTab={setSettingsTab} />
    </>,
    host,
  );
}
