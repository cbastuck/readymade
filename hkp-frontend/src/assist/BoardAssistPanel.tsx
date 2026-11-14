import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { useBoardContext } from "../BoardContext";
import { useSelection } from "../selection/SelectionContext";
import { useChromeRetracted } from "../facade/FacadeChrome";
import SettingsDialog from "../ui-components/SettingsDialog";
import ReadymadeMark from "../components/Toolbar/assets/hkp-single-dot-h.svg?react";
import { ASSIST_PROVIDER_LABELS, Effort } from "./settings";
import { carriesOn, continueHint } from "./outputLimit";
import {
  describeUsage,
  formatPrice,
  formatTokens,
  PRICES_AS_OF,
  tokenTotal,
} from "./usage";
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
  // The facade on its own is the app being used rather than built, and the
  // chrome around it retracts; the panel is part of that chrome. It is hidden
  // rather than closed, so it is back as it was when the board is.
  const retracted = useChromeRetracted();
  const shown = visible && !retracted;
  const assist = useBoardAssist({
    active: shown,
    focus: {
      runtimeId: selection?.selectedRuntimeId,
      serviceUuids: selection?.selectedServices?.uuids ?? [],
    },
  });
  const {
    settings,
    compatible,
    openCode,
    openCodeGo,
    mistral,
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
    total,
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
    if (shown) threadEnd.current?.scrollIntoView?.({ block: "end" });
  }, [entries, status, shown]);

  if (!host) return null;
  return createPortal(
    <>
      <aside
        id="board-ai-assist"
        className="hkp-assist"
        aria-label="Board Assist"
        hidden={!shown}
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
                  {ASSIST_PROVIDER_LABELS[settings.provider]}
                  {model ? ` · ${model.display_name}` : ""}
                  {!openCode &&
                    !openCodeGo &&
                    !mistral &&
                    ` · ${
                      compatible
                        ? settings.openAIThinking === "default"
                          ? "Server default"
                          : `Thinking ${settings.openAIThinking}`
                        : effort === "default"
                          ? "Model default"
                          : `${effort} effort`
                    }`}
                  {assist.takesOutputLimit &&
                    settings.outputLimit > 0 &&
                    ` · ${formatTokens(settings.outputLimit)} output limit`}
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
                  {Object.entries(ASSIST_PROVIDER_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
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
                        : assist.openAI
                          ? "Enter an OpenAI API key"
                          : compatible
                          ? "Configure an API server"
                          : openCode
                            ? "Configure an OpenCode server"
                            : openCodeGo
                              ? "Enter an OpenCode Go key"
                              : mistral
                                ? "Enter a Mistral API key"
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
              {assist.takesOutputLimit && (
                <>
                  <label title="The most one answer may write, the model's thinking included. Empty uses the model's default.">
                    Output limit{" "}
                    <input
                      className="hkp-assist-number"
                      type="text"
                      inputMode="numeric"
                      disabled={busy}
                      placeholder="Model default"
                      value={assist.outputLimitDraft}
                      aria-invalid={!!assist.outputLimitError || undefined}
                      onChange={(event) =>
                        assist.setOutputLimitDraft(event.target.value)
                      }
                      onBlur={assist.commitOutputLimit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") assist.commitOutputLimit();
                      }}
                    />
                  </label>
                  {assist.outputLimitError && (
                    <p role="alert" className="hkp-assist-error">
                      {assist.outputLimitError}
                    </p>
                  )}
                </>
              )}
              {!openCode && <div className="hkp-assist-row">
                {/* Go's and Mistral's models take no effort or template setting here. */}
                {!openCodeGo && !mistral && <label>
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
                </label>}
                <button
                  type="button"
                  disabled={busy || modelsLoading || !providerReady}
                  onClick={assist.refreshModels}
                >
                  Refresh models
                </button>
              </div>}
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
              {entry.usage && (
                <p className="hkp-assist-hint hkp-assist-usage">
                  {describeUsage(entry.usage, entry.modelId ?? "")}
                </p>
              )}
              {entry.reasoning && (
                <details>
                  <summary>Show the model's thinking</summary>
                  <pre>{entry.reasoning}</pre>
                </details>
              )}
              {entry.rawResponse !== undefined && (
                <details>
                  <summary>Show raw model response</summary>
                  <pre>{entry.rawResponse || "(Empty response)"}</pre>
                </details>
              )}
              {entry.retryWholeBoardPrompt && (
                <div className="hkp-assist-row">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void assist.retryWholeBoard(
                        entry.retryWholeBoardPrompt!,
                        index,
                      )
                    }
                  >
                    Switch to Whole board and retry
                  </button>
                </div>
              )}
              {entry.cutOff && assist.continuable(index) && (
                <div className="hkp-assist-row hkp-assist-continue">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void assist.continueTurn(index)}
                  >
                    {carriesOn(entry.cutOff) ? "Continue" : "Retry"}
                  </button>
                  <span className="hkp-assist-hint">
                    {continueHint(entry.cutOff, settings.outputLimit)}
                  </span>
                </div>
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
          {total.usage.requests > 0 && (
            <p
              className="hkp-assist-hint hkp-assist-usage-total"
              aria-label="Conversation usage"
              title={
                total.price === undefined
                  ? "No price: a model in this conversation has no list price here."
                  : `Anthropic API list prices as of ${PRICES_AS_OF}; every request counted, documentation lookups included.`
              }
            >
              This conversation: {formatTokens(tokenTotal(total.usage))} tokens
              in {total.usage.requests} request
              {total.usage.requests === 1 ? "" : "s"}
              {total.price !== undefined && <> · ≈ {formatPrice(total.price)}</>}
            </p>
          )}
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
          {(compatible || openCode || openCodeGo) &&
            unencryptedRemote(
              compatible
                ? settings.openAICompatibleUrl
                : openCodeGo
                  ? settings.openCodeGoUrl
                  : settings.openCodeUrl,
            ) && (
            <p className="hkp-assist-error" role="alert">
              This server is reached over unencrypted HTTP on another machine.
              Your {openCode ? "password" : openCodeGo ? "key" : "token"}, prompts and board can be read on the way.
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
