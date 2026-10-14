import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useBoardContext } from "../BoardContext";
import { useSelection } from "../selection/SelectionContext";
import { useNestedNavigation } from "../runtime/ui/NestedNavigation";
import { BoardDescriptor } from "../types";
import SettingsDialog from "../ui-components/SettingsDialog";
import { BoardDocuments, linkBoardDocument } from "../core/boardPersistence";
import {
  AssistModel,
  Conversation,
  listAssistModels,
  modelEfforts,
  runAssistTurn,
} from "./anthropic";
import { listOpenAIModels, runOpenAICompatibleTurn } from "./openAICompatible";
import { Effort, saveAssistSettings, useAssistSettings } from "./settings";
import { matchesAssistSnapshot } from "./snapshotComparison";
import { validateAssistBoard } from "./validation";
import BoardAssistPreview from "./BoardAssistPreview";
import "./assist.css";

type SavedSnapshot = {
  config: BoardDescriptor;
  units: BoardDocuments["units"];
};
type Entry = {
  role: "user" | "assistant";
  text: string;
  board?: BoardDescriptor;
  base?: string;
  applied?: boolean;
  rawResponse?: string;
};
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
  const currentBoard = useRef(board);
  currentBoard.current = board;
  const selection = useSelection();
  const navigation = useNestedNavigation();
  const settings = useAssistSettings();
  const compatible = settings.provider === "openai-compatible";
  const providerReady = compatible
    ? !!settings.openAICompatibleUrl.trim()
    : !!settings.anthropicToken.trim();
  const [models, setModels] = useState<AssistModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState("selection");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    current: BoardDescriptor;
    proposed: BoardDescriptor;
    entry: Entry;
    index: number;
    base: string;
  } | null>(null);
  const [previous, setPrevious] = useState<SavedSnapshot | null>(null);
  const conversation = useRef<Conversation>([]);
  const abort = useRef<AbortController | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!visible) return;
    setModels([]);
    setModelsLoading(false);
    if (!providerReady) return;
    const controller = new AbortController();
    setModelsLoading(true);
    setError("");
    (compatible
      ? listOpenAIModels(
          settings.openAICompatibleUrl,
          settings.openAICompatibleToken,
          controller.signal,
        )
      : listAssistModels(settings.anthropicToken, controller.signal)
    )
      .then((list) => {
        if (controller.signal.aborted) return;
        setModels(list);
        if (!list.length)
          setError("No available models were returned by this provider.");
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Could not query models.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    return () => controller.abort();
  }, [
    visible,
    settings.anthropicToken,
    settings.openAICompatibleUrl,
    settings.openAICompatibleToken,
    compatible,
    providerReady,
    reload,
  ]);
  useEffect(() => {
    abort.current?.abort();
    conversation.current = [];
    setEntries([]);
  }, [settings.provider, settings.openAICompatibleUrl]);
  useEffect(() => {
    if (visible) threadEnd.current?.scrollIntoView?.({ block: "end" });
  }, [entries, status, visible]);

  const model = models.find((item) => item.id === settings.model) ?? models[0];
  const efforts = modelEfforts(model);
  const effort = efforts.includes(settings.effort)
    ? settings.effort
    : "default";
  const updateSettings = (patch: Parameters<typeof saveAssistSettings>[0]) => {
    try {
      saveAssistSettings(patch);
    } catch {
      setError("Could not save assistant preferences.");
    }
  };
  const snapshot = async () => {
    const ctx = currentBoard.current;
    if (!ctx) throw new Error("No board is open.");
    const docs = await ctx.serializeBoardDocuments();
    if (!docs) throw new Error("Could not read the current board.");
    return JSON.parse(
      JSON.stringify({
        config: {
          ...docs.composition,
          boardName: ctx.boardName,
          facade: ctx.facade,
        },
        units: docs.units,
      }),
    ) as SavedSnapshot;
  };
  const originFor = (saved: SavedSnapshot) =>
    saved.units.length
      ? {
          describe: () => "current imported board documents",
          load: async (ref: { kind: "relative" | "absolute"; value: string }) =>
            saved.units.find((unit) => unit.uri === ref.value)?.board ?? null,
        }
      : undefined;
  const loadConfiguration = async (
    config: BoardDescriptor,
    saved: SavedSnapshot,
  ) => {
    const origin = originFor(saved);
    if (origin) await currentBoard.current!.setBoardState(config, origin);
    else await currentBoard.current!.setBoardState(config);
  };
  const send = async () => {
    if (!prompt.trim() || !model || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Reading the current board…");
    const controller = new AbortController();
    abort.current = controller;
    const text = prompt.trim();
    setPrompt("");
    const index = entries.length + 1;
    let rawResponse: string | undefined;
    setEntries((list) => [
      ...list,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);
    try {
      const captured = await snapshot();
      const config = captured.config;
      const ctx = currentBoard.current!;
      const request = {
        token: compatible
          ? settings.openAICompatibleToken
          : settings.anthropicToken,
        model,
        effort,
        prompt: text,
        conversation: conversation.current,
        context: {
          board: config,
          importedUnitDocuments: captured.units,
          scope,
          selectedRuntimeId:
            scope === "board" ? null : selection?.selectedRuntimeId,
          selectedServiceUuids:
            scope === "board" ? [] : (selection?.selectedServices?.uuids ?? []),
          openNestedPipeline: navigation?.stack ?? [],
          availableRuntimeEngines: ctx.availableRuntimeEngines,
          serviceCatalog: Object.fromEntries(
            Object.entries(ctx.registry).map(([id, services]) => [
              id,
              services.map((svc) => ({
                serviceId: svc.serviceId,
                serviceName: svc.serviceName,
              })),
            ]),
          ),
        },
        signal: controller.signal,
        onStatus: setStatus,
        onRawResponse: (output: string) => {
          rawResponse = output;
        },
        onText: (generated: string) =>
          setEntries((list) =>
            list.map((entry, i) =>
              i === index ? { ...entry, text: generated } : entry,
            ),
          ),
      };
      const result = compatible
        ? await runOpenAICompatibleTurn({
            ...request,
            baseURL: settings.openAICompatibleUrl,
            contextTokens: settings.openAIContextTokens,
            thinking: settings.openAIThinking,
          })
        : await runAssistTurn(request);
      controller.signal.throwIfAborted();
      conversation.current = result.conversation;
      setEntries((list) =>
        list.map((entry, i) =>
          i === index
            ? {
                role: "assistant",
                text: result.text,
                board: result.board,
                rawResponse: result.board ? undefined : rawResponse,
                base: JSON.stringify(captured),
              }
            : entry,
        ),
      );
    } catch (err) {
      const message = controller.signal.aborted
        ? "Request stopped. No proposal was applied."
        : err instanceof Error
          ? err.message
          : "The assistant could not complete the request.";
      setError(message);
      setEntries((list) =>
        list.map((entry, i) =>
          i === index
            ? { role: "assistant", text: message, rawResponse }
            : entry,
        ),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
      abort.current = null;
    }
  };
  const previewChanges = async (entry: Entry, index: number) => {
    if (!entry.board || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Reading the current board for preview…");
    try {
      const current = await snapshot();
      setPreview({
        current: current.config,
        proposed: entry.board,
        entry,
        index,
        base: JSON.stringify(current),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not preview the board.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
    }
  };
  const apply = async (entry: Entry, index: number) => {
    if (!entry.board || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Checking and applying the proposed board…");
    try {
      const candidate = validateAssistBoard(entry.board);
      const before = await snapshot();
      if (!matchesAssistSnapshot(before, entry.base))
        throw new Error(
          "The board changed since this proposal. Ask the assistant to update its proposal using the current board.",
        );
      // The same linker used by the loader checks block and facade references
      // before any running runtime is removed.
      await linkBoardDocument(candidate, originFor(before));
      if (!matchesAssistSnapshot(await snapshot(), entry.base))
        throw new Error(
          "The board changed while checking this proposal. Ask for an updated proposal.",
        );
      setPrevious(before);
      await loadConfiguration(candidate, before);
      currentBoard.current!.markBoardChanged();
      setEntries((list) =>
        list.map((item, i) =>
          i === index
            ? { ...item, board: candidate, base: entry.base, applied: true }
            : item,
        ),
      );
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not apply the board. You can revert if loading failed.",
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
    }
  };
  const revert = async () => {
    if (!previous || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Restoring the previous board…");
    try {
      await loadConfiguration(previous.config, previous);
      currentBoard.current!.markBoardChanged();
      setPrevious(null);
      setEntries((list) => [
        ...list,
        {
          role: "assistant",
          text: "Restored the board configuration from before the last assistant change.",
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not restore the previous board.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
    }
  };
  const selectedRuntime = board?.runtimes.find(
    (rt) => rt.id === selection?.selectedRuntimeId,
  );
  const selectedCount = selection?.selectedServices?.uuids.length ?? 0;
  if (!host) return null;
  return createPortal(
    <>
      <aside
        id="board-ai-assist"
        className="hkp-assist"
        aria-label="Board AI assistant"
        hidden={!visible}
      >
        <header>
          <span>
            <Sparkles size={16} /> Board assistant
          </span>
          <button
            type="button"
            aria-label="Close board assistant"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="hkp-assist-controls">
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
              onClick={() => setReload((value) => value + 1)}
            >
              Refresh models
            </button>
          </div>
          <label>
            Context{" "}
            <select
              disabled={busy}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="board">Whole board</option>
              <option value="selection">
                {selectedCount
                  ? `${selectedCount} selected service${selectedCount === 1 ? "" : "s"} · ${selectedRuntime?.name ?? "runtime"}`
                  : selectedRuntime
                    ? `Selected runtime · ${selectedRuntime.name}`
                    : "Whole board (nothing selected)"}
              </option>
            </select>
          </label>
        </div>
        <div
          className="hkp-assist-thread"
          role="log"
          aria-label="Assistant conversation"
          aria-live="polite"
        >
          {!entries.length && (
            <p className="hkp-assist-hint">
              Describe a new board, ask to change this board, or select a
              service and ask to configure it. Review the proposal before
              applying it.
            </p>
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
                <div className="hkp-assist-row">
                  <button
                    type="button"
                    disabled={busy || entry.applied}
                    onClick={() => void previewChanges(entry, index)}
                  >
                    Preview changes
                  </button>
                  <button
                    type="button"
                    disabled={busy || entry.applied}
                    onClick={() => void apply(entry, index)}
                  >
                    {entry.applied ? "Applied" : "Apply board"}
                  </button>
                </div>
              )}
            </article>
          ))}
          {status && (
            <p role="status" className="hkp-assist-hint">
              {status}
            </p>
          )}
          <div ref={threadEnd} />
        </div>
        {(previous || entries.some((entry) => entry.board)) && (
          <div className="hkp-assist-change-actions">
            <button
              type="button"
              disabled={busy || !previous}
              title={
                previous
                  ? "Restore the configuration before the last assistant change"
                  : "Apply a proposal to enable revert"
              }
              onClick={() => void revert()}
            >
              Revert last change
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="hkp-assist-error">
            {error}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Message to board assistant"
            placeholder="What would you like to build or change?"
            value={prompt}
            disabled={busy}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void send();
              }
            }}
            rows={3}
          />
          <div className="hkp-assist-row">
            <button
              type="button"
              disabled={busy || !entries.length}
              onClick={() => {
                setEntries([]);
                conversation.current = [];
                setError("");
              }}
            >
              New conversation
            </button>
            {busy ? (
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                disabled={!abort.current}
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
                disabled={!prompt.trim() || !model || !providerReady}
              >
                Send
              </button>
            )}
          </div>
          <p className="hkp-assist-hint">
            {compatible
              ? `Requests go to ${settings.openAICompatibleUrl}.`
              : "Prompts and board configuration are sent to Anthropic."}
          </p>
        </form>
      </aside>
      {preview && (
        <BoardAssistPreview
          current={preview.current}
          proposed={preview.proposed}
          onClose={() => setPreview(null)}
          onApply={(board) =>
            apply(
              { ...preview.entry, board, base: preview.base },
              preview.index,
            )
          }
          busy={busy}
          error={error}
        />
      )}
      <SettingsDialog tab={settingsTab} onChangeTab={setSettingsTab} />
    </>,
    host,
  );
}
