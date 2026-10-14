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
import { Effort, saveAssistSettings, useAssistSettings } from "./settings";
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
  const [previous, setPrevious] = useState<SavedSnapshot | null>(null);
  const conversation = useRef<Conversation>([]);
  const abort = useRef<AbortController | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!visible) return;
    setModels([]);
    setModelsLoading(false);
    if (!settings.anthropicToken.trim()) return;
    const controller = new AbortController();
    setModelsLoading(true);
    setError("");
    listAssistModels(settings.anthropicToken, controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setModels(list);
        if (!list.length)
          setError("No available models were returned for this token.");
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
  }, [visible, settings.anthropicToken, reload]);
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
    setEntries((list) => [
      ...list,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);
    try {
      const captured = await snapshot();
      const config = captured.config;
      const ctx = currentBoard.current!;
      const result = await runAssistTurn({
        token: settings.anthropicToken,
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
        onText: (generated) =>
          setEntries((list) =>
            list.map((entry, i) =>
              i === index ? { ...entry, text: generated } : entry,
            ),
          ),
      });
      controller.signal.throwIfAborted();
      conversation.current = result.conversation;
      setEntries((list) =>
        list.map((entry, i) =>
          i === index
            ? {
                role: "assistant",
                text: result.text,
                board: result.board,
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
          i === index ? { role: "assistant", text: message } : entry,
        ),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
      abort.current = null;
    }
  };
  const apply = async (entry: Entry, index: number) => {
    if (!entry.board || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Checking and applying the proposed board…");
    try {
      const before = await snapshot();
      if (JSON.stringify(before) !== entry.base)
        throw new Error(
          "The board changed since this proposal. Ask the assistant to update its proposal using the current board.",
        );
      // The same linker used by the loader checks block and facade references
      // before any running runtime is removed.
      await linkBoardDocument(entry.board, originFor(before));
      if (JSON.stringify(await snapshot()) !== entry.base)
        throw new Error(
          "The board changed while checking this proposal. Ask for an updated proposal.",
        );
      setPrevious(before);
      await loadConfiguration(entry.board, before);
      currentBoard.current!.markBoardChanged();
      setEntries((list) =>
        list.map((item, i) =>
          i === index ? { ...item, applied: true } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not apply the board. You can revert if loading failed.",
      );
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
          <div className="hkp-assist-row">
            <button type="button" onClick={() => setSettingsTab("ai-assist")}>
              API settings
            </button>
          </div>
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
                disabled={busy || efforts.length === 1}
                value={effort}
                onChange={(event) =>
                  updateSettings({ effort: event.target.value as Effort })
                }
              >
                {efforts.map((level) => (
                  <option key={level} value={level}>
                    {level === "default" ? "Model default" : level}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || modelsLoading || !settings.anthropicToken}
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
              {entry.board && (
                <>
                  <details>
                    <summary>Review board configuration</summary>
                    <pre>{JSON.stringify(entry.board, null, 2)}</pre>
                  </details>
                  <button
                    type="button"
                    disabled={busy || entry.applied}
                    onClick={() => void apply(entry, index)}
                  >
                    {entry.applied ? "Applied" : "Apply board"}
                  </button>
                </>
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
              title={previous ? "Restore the configuration before the last assistant change" : "Apply a proposal to enable revert"}
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
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim() || !model || !settings.anthropicToken}
              >
                Send
              </button>
            )}
          </div>
          <p className="hkp-assist-hint">
            Prompts and board configuration are sent to Anthropic.
          </p>
        </form>
      </aside>
      <SettingsDialog tab={settingsTab} onChangeTab={setSettingsTab} />
    </>,
    host,
  );
}
