import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useBoardContext } from "../../BoardContext";
import AssistConnectionNotice from "../../assist/AssistConnectionNotice";
import { unencryptedRemote } from "../../assist/addresses";
import { Effort } from "../../assist/settings";
import { useBoardAssist, type AssistFocus } from "../../assist/useBoardAssist";
import BottomSheet from "../playground/mobile/BottomSheet";
import MobileIcon from "../playground/mobile/MobileIcon";
import MobilePage from "../playground/mobile/MobilePage";
import { M } from "../playground/mobile/tokens";
import MobileAssistPreview from "./MobileAssistPreview";
import { button, confirmCss, sectionLabel } from "./mobileAssistStyles";

type Props = {
  /** Whether the page is showing. It stays mounted while hidden, so the
   *  conversation survives a look at the board. */
  open: boolean;
  onBack: () => void;
  /** What "only this runtime" narrows a request to: what was opened last. */
  focus: AssistFocus;
  /** Opens Board Assist's settings; absent on a host without settings. */
  onOpenSettings?: () => void;
};

const card: CSSProperties = {
  background: M.card,
  border: `1px solid ${M.border}`,
  borderRadius: 12,
};

const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: 10,
  border: `1px solid ${M.borderStrong}`,
  background: M.bg,
  color: M.textPrimary,
  // >= 16px so iOS Safari does not auto-zoom into the field.
  fontSize: 16,
  fontFamily: "inherit",
};

const hint: CSSProperties = {
  margin: "8px 4px 0",
  fontSize: 12,
  lineHeight: 1.4,
  color: M.textMuted,
};

/**
 * Board Assist as a page: the conversation, each proposal with what it would
 * change, and the request's context — the whole board, or the runtime the
 * person last had open — chosen above it. The desktop panel's logic
 * (`useBoardAssist`); this is its layout for a phone.
 */
export default function MobileAssistPage({ open, onBack, focus, onOpenSettings }: Props) {
  const board = useBoardContext();
  const assist = useBoardAssist({ active: open, focus });
  const {
    settings,
    compatible,
    openCode,
    providerReady,
    modelsLoading,
    model,
    effort,
    entries,
    prompt,
    scope,
    busy,
    status,
    error,
    pendingConnection,
    confirmRevert,
    selectedRuntime,
    preview,
  } = assist;
  const [modelSheet, setModelSheet] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) threadEnd.current?.scrollIntoView?.({ block: "end" });
  }, [entries, status, open]);

  const focusedService =
    selectedRuntime && focus.serviceUuids.length === 1
      ? board?.services[selectedRuntime.id]?.find(
          (svc) => svc.uuid === focus.serviceUuids[0],
        )
      : undefined;
  const narrowed = scope === "selection" && !!selectedRuntime;
  const effortLabel = compatible
    ? settings.openAIThinking === "default"
      ? "Server default"
      : `Thinking ${settings.openAIThinking}`
    : openCode
      ? "OpenCode server"
    : effort === "default"
      ? "Model default"
      : `${effort} effort`;

  return (
    <div style={{ display: open ? "contents" : "none" }}>
      <MobilePage
        title="Board Assist"
        onBack={onBack}
        overlay={
          <BottomSheet
            open={modelSheet}
            onClose={() => setModelSheet(false)}
            title="Model"
            height="auto"
          >
            <ModelSettings assist={assist} onOpenSettings={onOpenSettings} />
          </BottomSheet>
        }
      >
        <style>{confirmCss}</style>
        <div className="hkp-assist-mobile" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
          <button
            type="button"
            onClick={() => (providerReady ? setModelSheet(true) : onOpenSettings?.())}
            style={{
              ...card,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 14px",
              textAlign: "left",
              fontFamily: "inherit",
              color: M.textPrimary,
              cursor: "pointer",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>
                {compatible
                  ? "OpenAI compatible"
                  : openCode
                    ? "OpenCode server"
                    : "Anthropic"}
                {model ? ` · ${model.display_name}` : ""}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: M.textSecondary }}>
                {!providerReady
                  ? "Set up a provider to start"
                  : modelsLoading
                    ? "Querying models…"
                    : effortLabel}
              </span>
            </span>
            <MobileIcon name="chevronRight" size={16} color={M.textMuted} />
          </button>

          <div
            role="radiogroup"
            aria-label="Context"
            style={{
              display: "flex",
              gap: 4,
              marginTop: 10,
              padding: 3,
              borderRadius: 11,
              background: "rgba(0,0,0,0.06)",
            }}
          >
            {[
              { id: "board", label: "Whole board", enabled: true },
              {
                id: "selection",
                label: selectedRuntime
                  ? `${selectedRuntime.name}${focusedService ? ` · ${focusedService.serviceName ?? focusedService.uuid}` : ""}`
                  : "Open a runtime",
                enabled: !!selectedRuntime,
              },
            ].map((option) => {
              const chosen = option.id === "board" ? !narrowed : narrowed;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={busy || !option.enabled}
                  onClick={() => assist.setScope(option.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 9,
                    background: chosen ? M.card : "transparent",
                    boxShadow: chosen ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    color: option.enabled ? M.textPrimary : M.textMuted,
                    fontSize: 13.5,
                    fontWeight: chosen ? 600 : 500,
                    fontFamily: "inherit",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div
            role="log"
            aria-label="Board Assist conversation"
            aria-live="polite"
            style={{ flex: 1, marginTop: 6 }}
          >
            {!entries.length && (
              <p style={{ ...hint, margin: "28px 12px", fontSize: 14, textAlign: "center" }}>
                {providerReady
                  ? "Ask for a change to this board — a service added, a runtime rewired, a facade over it. Nothing changes until you have looked at the proposal and applied it."
                  : "Board Assist sends your request to a model provider you choose. Set one up to start."}
              </p>
            )}
            {!providerReady && onOpenSettings && (
              <button type="button" onClick={onOpenSettings} style={{ ...button("primary", true), width: "100%" }}>
                Set up a provider
              </button>
            )}
            {entries.map((entry, index) => (
              <div
                key={index}
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: entry.role === "user" ? "flex-end" : "stretch",
                }}
              >
                <div
                  style={
                    entry.role === "user"
                      ? {
                          maxWidth: "85%",
                          padding: "9px 13px",
                          borderRadius: "16px 16px 4px 16px",
                          background: M.teal,
                          color: "#fff",
                          fontSize: 15,
                          lineHeight: 1.4,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }
                      : { ...card, padding: "10px 14px", fontSize: 15, lineHeight: 1.45 }
                  }
                >
                  {entry.role === "assistant" && (
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: M.textMuted, marginBottom: 3 }}>
                      Assistant
                    </div>
                  )}
                  <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {entry.text || (busy && index === entries.length - 1 ? "…" : "")}
                  </div>
                  {entry.rawResponse !== undefined && (
                    <details style={{ marginTop: 8, fontSize: 13 }}>
                      <summary>Show raw model response</summary>
                      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 11.5 }}>
                        {entry.rawResponse || "(Empty response)"}
                      </pre>
                    </details>
                  )}
                  {entry.board && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${M.border}` }}>
                      <p
                        role={entry.preflightError ? "alert" : undefined}
                        style={{
                          margin: "0 0 10px",
                          fontSize: 13,
                          color: entry.preflightError ? M.danger : M.textSecondary,
                        }}
                      >
                        {entry.applied
                          ? "Applied to the board."
                          : entry.preflightError
                            ? `Preflight failed: ${entry.preflightError}`
                            : entry.preflightPassed
                              ? "Preflight passed. Review before applying."
                              : "Review before applying."}
                      </p>
                      {pendingConnection?.index === index && !preview && (
                        <AssistConnectionNotice
                          addresses={pendingConnection.addresses}
                          busy={busy}
                          onAccept={() => void assist.acceptConnection()}
                          onCancel={assist.cancelConnection}
                        />
                      )}
                      {confirmRevert === index && (
                        <div className="hkp-assist-confirm" role="alert">
                          <p>
                            The board changed after this proposal was applied.
                            Reverting restores the board from before the
                            proposal and discards those later changes.
                          </p>
                          <div className="hkp-assist-row">
                            <button type="button" disabled={busy} onClick={assist.keepCurrentBoard}>
                              Keep current board
                            </button>
                            <button type="button" disabled={busy} onClick={() => void assist.revert(index, true)}>
                              Revert anyway
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void assist.previewChanges(entry, index)}
                          style={button("plain", !busy)}
                        >
                          Review changes
                        </button>
                        {assist.revertible(index) ? (
                          <button
                            type="button"
                            disabled={busy || !assist.canRevert}
                            onClick={() => void assist.revert(index)}
                            style={button("plain", !busy && assist.canRevert)}
                          >
                            Revert
                          </button>
                        ) : (
                          !entry.applied && (
                            <button
                              type="button"
                              disabled={busy || !!entry.preflightError}
                              onClick={() => void assist.apply(entry, index)}
                              style={button("primary", !busy && !entry.preflightError)}
                            >
                              Apply
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {status && (
              <p role="status" style={hint}>
                {status}
              </p>
            )}
            {assist.knowledgeNotice && (
              <p role="status" style={hint}>
                {assist.knowledgeNotice}
              </p>
            )}
            <div ref={threadEnd} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void assist.send();
            }}
            style={{
              position: "sticky",
              bottom: 0,
              marginTop: 12,
              paddingTop: 10,
              background: M.bg,
            }}
          >
            {error && (
              <p role="alert" style={{ margin: "0 4px 8px", fontSize: 13, color: M.danger }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                aria-label="Request"
                value={prompt}
                disabled={busy || !providerReady}
                placeholder={providerReady ? "Ask for a change…" : "Set up a provider first"}
                rows={Math.min(5, Math.max(1, prompt.split("\n").length))}
                onChange={(event) => assist.setPrompt(event.target.value)}
                style={{ ...field, flex: 1, resize: "none", borderRadius: 18, padding: "9px 14px" }}
              />
              {busy ? (
                <button
                  type="button"
                  aria-label="Stop"
                  onClick={assist.stop}
                  disabled={!assist.stoppable}
                  style={roundButton(M.textPrimary, assist.stoppable)}
                >
                  <MobileIcon name="square" size={15} color="#fff" strokeWidth={2.4} />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={!prompt.trim() || !model || !providerReady}
                  style={roundButton(M.teal, !!prompt.trim() && !!model && providerReady)}
                >
                  <MobileIcon name="send" size={16} color="#fff" strokeWidth={2} />
                </button>
              )}
            </div>
            <p style={hint}>{assist.disclosure}</p>
            {(compatible || openCode) &&
              unencryptedRemote(
                compatible ? settings.openAICompatibleUrl : settings.openCodeUrl,
              ) && (
              <p role="alert" style={{ ...hint, color: M.danger }}>
                This server is reached over unencrypted HTTP on another
                machine. Your {openCode ? "password" : "token"}, prompts and
                board can be read on the way.
              </p>
            )}
            {entries.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={assist.newConversation}
                style={{
                  margin: "6px 0 0",
                  padding: "6px 4px",
                  border: "none",
                  background: "none",
                  color: M.tealDark,
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                New conversation
              </button>
            )}
          </form>
        </div>
      </MobilePage>
      {preview && <MobileAssistPreview assist={assist} />}
    </div>
  );
}

function roundButton(color: string, enabled: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: "50%",
    border: "none",
    background: enabled ? color : M.border,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: enabled ? "pointer" : "default",
  };
}

/** Which model answers, and how hard it thinks: chosen per request. */
function ModelSettings({
  assist,
  onOpenSettings,
}: {
  assist: ReturnType<typeof useBoardAssist>;
  onOpenSettings?: () => void;
}) {
  const { settings, compatible, openCode, models, modelsLoading, model, efforts, effort, busy } = assist;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ fontSize: 13, color: M.textSecondary }}>
        Model
        <select
          disabled={busy || modelsLoading || !models.length}
          value={model?.id ?? ""}
          onChange={(event) => assist.updateSettings({ model: event.target.value })}
          style={{ ...field, marginTop: 6 }}
        >
          {!models.length && (
            <option value="">{modelsLoading ? "Querying models…" : "No models"}</option>
          )}
          {models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.display_name}
            </option>
          ))}
        </select>
      </label>
      {!openCode && <label style={{ fontSize: 13, color: M.textSecondary }}>
        {compatible ? "Thinking" : "Effort"}
        <select
          disabled={busy || (!compatible && efforts.length === 1)}
          value={compatible ? settings.openAIThinking : effort}
          onChange={(event) =>
            assist.updateSettings(
              compatible
                ? { openAIThinking: event.target.value as typeof settings.openAIThinking }
                : { effort: event.target.value as Effort },
            )
          }
          style={{ ...field, marginTop: 6 }}
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
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
        <input
          type="checkbox"
          disabled={busy}
          checked={settings.includeAssetContents}
          onChange={(event) => assist.updateSettings({ includeAssetContents: event.target.checked })}
          style={{ width: 20, height: 20, accentColor: M.teal }}
        />
        Include asset contents
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          disabled={busy || modelsLoading}
          onClick={assist.refreshModels}
          style={button("plain", !busy && !modelsLoading)}
        >
          Refresh models
        </button>
        {onOpenSettings && (
          <button type="button" onClick={onOpenSettings} style={button("plain", true)}>
            Provider…
          </button>
        )}
      </div>
      <div style={{ ...sectionLabel, margin: 0, textTransform: "none", letterSpacing: 0, fontWeight: 400, fontSize: 12.5 }}>
        Provider, server and knowledge server are in Settings, under Board Assist.
      </div>
    </div>
  );
}
