import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { useBoardContext } from "../BoardContext";
import { useSelection } from "../selection/SelectionContext";
import { useNestedNavigation } from "../runtime/ui/NestedNavigation";
import { BoardDescriptor } from "../types";
import SettingsDialog from "../ui-components/SettingsDialog";
import ReadymadeMark from "../components/Toolbar/assets/hkp-single-dot-h.svg?react";
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
import {
  addUsage,
  AssistUsage,
  describeUsage,
  formatPrice,
  formatTokens,
  noUsage,
  priceOf,
  PRICES_AS_OF,
  tokenTotal,
} from "./usage";
import { captureBoardRenderFailures } from "../core/renderFailures";
import BoardAssistPrompt from "./BoardAssistPrompt";
import BoardAssistPromptResizer, {
  BOARD_ASSIST_DEFAULT_PROMPT_HEIGHT,
  BOARD_ASSIST_MAX_PROMPT_HEIGHT,
  BOARD_ASSIST_PROMPT_HEIGHT_KEY,
  clampBoardAssistPromptHeight,
} from "./BoardAssistPromptResizer";
import BoardAssistPreview from "./BoardAssistPreview";
import { boardAssistKnowledgeProvider } from "./mcpKnowledge";
import { assistContext, resolveAssistScope } from "./scope";
import {
  hasNewAddresses,
  nameKeptServers,
  newAddresses,
  NewAddresses,
  unencryptedRemote,
} from "./addresses";
import AssistConnectionNotice from "./AssistConnectionNotice";
import BoardAssistResizer, {
  BOARD_ASSIST_DEFAULT_WIDTH,
  BOARD_ASSIST_WIDTH_KEY,
  clampBoardAssistWidth,
} from "./BoardAssistResizer";
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
  preflightError?: string;
  preflightPassed?: boolean;
  /** Every request the turn made, and the model it was priced for. */
  usage?: AssistUsage;
  modelId?: string;
};

/**
 * The conversation so far, every turn's requests together — the figure a
 * price beside a conversation has to be, since most of what a turn reads is
 * documentation it looked up on the way. Priced per turn, because the model
 * can change between turns; unpriced when any turn's model has no price.
 */
function conversationUsage(entries: Entry[]) {
  let usage = noUsage;
  let price: number | undefined = 0;
  for (const entry of entries) {
    if (!entry.usage) continue;
    usage = addUsage(usage, entry.usage);
    const turn = priceOf(entry.modelId ?? "", entry.usage);
    price = price === undefined || turn === undefined ? undefined : price + turn;
  }
  return { usage, price };
}
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
  const [scope, setScope] = useState("selection");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("");
  const [knowledgeNotice, setKnowledgeNotice] = useState("");
  const [error, setError] = useState("");
  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    current: BoardDescriptor;
    proposed: BoardDescriptor;
    entry: Entry;
    index: number;
    base: string;
    readOnly: boolean;
  } | null>(null);
  const [previous, setPrevious] = useState<SavedSnapshot | null>(null);
  const [revertEntryIndex, setRevertEntryIndex] = useState<number | null>(null);
  // The board right after the proposal was applied. Reverting when the board
  // has moved on since would discard those later changes, so it asks first.
  // Absent when applying failed half-way: then reverting is the recovery.
  const [appliedSnapshot, setAppliedSnapshot] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<number | null>(null);
  // A proposal waiting for the person to accept addresses it would contact.
  const [pendingConnection, setPendingConnection] = useState<{
    entry: Entry;
    index: number;
    addresses: NewAddresses;
  } | null>(null);
  const conversation = useRef<Conversation>([]);
  const abort = useRef<AbortController | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);

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
  // What revert and pending confirmations point at are entries of the
  // conversation; a new conversation reuses those positions for other entries.
  const forgetConversation = () => {
    conversation.current = [];
    setEntries([]);
    setPrevious(null);
    setRevertEntryIndex(null);
    setAppliedSnapshot(null);
    setConfirmRevert(null);
    setPendingConnection(null);
  };
  useEffect(() => {
    abort.current?.abort();
    forgetConversation();
  }, [
    settings.provider,
    settings.openAICompatibleUrl,
    settings.mcpKnowledgeUrl,
  ]);
  useEffect(() => {
    if (visible) threadEnd.current?.scrollIntoView?.({ block: "end" });
  }, [entries, status, visible]);

  const model = models.find((item) => item.id === settings.model) ?? models[0];
  const total = conversationUsage(entries);
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
    setKnowledgeNotice("");
    setPendingConnection(null);
    setStatus("Reading the current board…");
    const controller = new AbortController();
    abort.current = controller;
    const knowledgeProvider = boardAssistKnowledgeProvider(
      settings.mcpKnowledgeUrl,
      controller.signal,
      (reason) =>
        setKnowledgeNotice(
          `MCP knowledge server unavailable; used bundled documentation. ${reason.message}`,
        ),
    );
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
      const editScope = resolveAssistScope(
        config,
        scope,
        selection?.selectedRuntimeId,
      );
      const request = {
        token: compatible
          ? settings.openAICompatibleToken
          : settings.anthropicToken,
        model,
        effort,
        prompt: text,
        conversation: conversation.current,
        scope: editScope,
        base: config,
        context: assistContext(config, editScope, {
          includeAssetContents: settings.includeAssetContents,
          units: captured.units,
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
        }),
        signal: controller.signal,
        onStatus: setStatus,
        onRawResponse: (output: string) => {
          rawResponse = output;
        },
        onUsage: (usage: AssistUsage) =>
          setEntries((list) =>
            list.map((entry, i) =>
              i === index ? { ...entry, usage, modelId: model.id } : entry,
            ),
          ),
        onText: (generated: string) =>
          setEntries((list) =>
            list.map((entry, i) =>
              i === index ? { ...entry, text: generated } : entry,
            ),
          ),
        knowledgeProvider,
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
      // A server the person keeps is named, not addressed, whatever the model
      // wrote — and said so, since the proposal then differs from its text.
      const named = result.board
        ? nameKeptServers(config, result.board, ctx.availableRuntimeEngines)
        : undefined;
      const proposal = named?.board;
      const renamedNote = named?.renamed.length
        ? `Runtime ${named.renamed
            .map(({ runtimeId, remote }) => `${runtimeId} now names your server "${remote}"`)
            .join(", ")} instead of its address.`
        : "";
      let preflightError: string | undefined;
      if (proposal) {
        setStatus("Preflighting the proposed board…");
        try {
          const candidate = validateAssistBoard(proposal);
          await linkBoardDocument(candidate, originFor(captured));
        } catch (err) {
          preflightError =
            err instanceof Error
              ? err.message
              : "The proposed board did not pass preflight.";
        }
      }
      const completedEntry: Entry = {
        role: "assistant",
        text: [result.text, renamedNote].filter(Boolean).join("\n\n"),
        board: proposal,
        rawResponse: proposal ? undefined : rawResponse,
        base: JSON.stringify(captured),
        preflightError,
        preflightPassed: !!proposal && !preflightError,
        usage: result.usage,
        modelId: model.id,
      };
      setEntries((list) =>
        list.map((entry, i) =>
          i === index ? completedEntry : entry,
        ),
      );
      if (completedEntry.board) setStatus("Proposal ready for review.");
    } catch (err) {
      const message = controller.signal.aborted
        ? "Request stopped. No proposal was applied."
        : err instanceof Error
          ? err.message
          : "The assistant could not complete the request.";
      setError(message);
      setEntries((list) =>
        list.map((entry, i) =>
          // What a failed turn already spent is still spent.
          i === index
            ? {
                role: "assistant",
                text: message,
                rawResponse,
                usage: entry.usage,
                modelId: entry.modelId,
              }
            : entry,
        ),
      );
    } finally {
      await knowledgeProvider.close?.();
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
    setStatus("Preparing the board changes…");
    try {
      if (entry.applied && entry.base) {
        const base = JSON.parse(entry.base) as SavedSnapshot;
        setPreview({
          current: base.config,
          proposed: entry.board,
          entry,
          index,
          base: entry.base,
          readOnly: true,
        });
        return;
      }
      const current = await snapshot();
      setPreview({
        current: current.config,
        proposed: entry.board,
        entry,
        index,
        base: JSON.stringify(current),
        readOnly: false,
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
  const applyCandidate = async (
    entry: Entry,
    index: number,
    connectionAccepted: boolean,
  ) => {
    if (!entry.board) return false;
    try {
      const candidate = validateAssistBoard(entry.board);
      const before = await snapshot();
      if (!matchesAssistSnapshot(before, entry.base))
        throw new Error(
          "The board changed since this proposal. Ask the assistant to update its proposal using the current board.",
        );
      if (!connectionAccepted) {
        const addresses = newAddresses(before, candidate);
        if (hasNewAddresses(addresses)) {
          setPendingConnection({ entry, index, addresses });
          return false;
        }
      }
      setPendingConnection(null);
      // The same linker used by the loader checks block and facade references
      // before any running runtime is removed.
      await linkBoardDocument(candidate, originFor(before));
      if (!matchesAssistSnapshot(await snapshot(), entry.base))
        throw new Error(
          "The board changed while checking this proposal. Ask for an updated proposal.",
        );
      try {
        await captureBoardRenderFailures(() =>
          loadConfiguration(candidate, before),
        );
      } catch (candidateError) {
        setStatus("The proposal failed. Restoring the previous board…");
        try {
          await loadConfiguration(before.config, before);
        } catch (restoreError) {
          setPrevious(before);
          setRevertEntryIndex(index);
          setAppliedSnapshot(null);
          setConfirmRevert(null);
          const proposedMessage =
            candidateError instanceof Error
              ? candidateError.message
              : "The proposed board failed to load.";
          const restoreMessage =
            restoreError instanceof Error
              ? restoreError.message
              : "The previous board could not be restored.";
          throw new Error(`${proposedMessage} ${restoreMessage}`);
        }
        throw new Error(
          `${
            candidateError instanceof Error
              ? candidateError.message
              : "The proposed board failed to load."
          } The previous board was restored.`,
        );
      }
      setPrevious(before);
      setRevertEntryIndex(index);
      setAppliedSnapshot(JSON.stringify(await snapshot()));
      setConfirmRevert(null);
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
    }
  };
  const apply = async (
    entry: Entry,
    index: number,
    connectionAccepted = false,
  ) => {
    if (!entry.board || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Preflighting and applying the proposed board…");
    try {
      return await applyCandidate(entry, index, connectionAccepted);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
    }
  };
  const revert = async (index: number, discardLaterChanges = false) => {
    if (!previous || revertEntryIndex !== index || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Restoring the previous board…");
    try {
      if (
        !discardLaterChanges &&
        appliedSnapshot &&
        !matchesAssistSnapshot(await snapshot(), appliedSnapshot)
      ) {
        setConfirmRevert(index);
        return;
      }
      setConfirmRevert(null);
      await loadConfiguration(previous.config, previous);
      currentBoard.current!.markBoardChanged();
      setPrevious(null);
      setRevertEntryIndex(null);
      setAppliedSnapshot(null);
      setEntries((list) =>
        list.map((entry, i) =>
          i === index ? { ...entry, applied: false } : entry,
        ),
      );
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
                  onClick={() => setReload((value) => value + 1)}
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
              onChange={(event) => setScope(event.target.value)}
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
                        void apply(pendingConnection.entry, index, true)
                      }
                      onCancel={() => setPendingConnection(null)}
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
                          onClick={() => setConfirmRevert(null)}
                        >
                          Keep current board
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void revert(index, true)}
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
                      onClick={() => void previewChanges(entry, index)}
                    >
                      Show changes
                    </button>
                    {revertEntryIndex === index ? (
                      <button
                        type="button"
                        disabled={busy || !previous}
                        onClick={() => void revert(index)}
                      >
                        Revert
                      </button>
                    ) : (
                      !entry.applied && (
                        <button
                          type="button"
                          disabled={busy || !!entry.preflightError}
                          onClick={() => void apply(entry, index)}
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
          {knowledgeNotice && (
            <p role="status" className="hkp-assist-hint">
              {knowledgeNotice}
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
            void send();
          }}
        >
          <BoardAssistPrompt
            board={board}
            value={prompt}
            disabled={busy}
            height={promptHeight}
            onChange={setPrompt}
            onSubmit={() => void send()}
          />
          <div className="hkp-assist-row">
            <button
              type="button"
              disabled={busy || !entries.length}
              onClick={() => {
                forgetConversation();
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
                className="hkp-assist-primary"
                disabled={!prompt.trim() || !model || !providerReady}
              >
                Send
              </button>
            )}
          </div>
          <p className="hkp-assist-hint">
            {`Your prompt and ${
              scope === "selection" && selectedRuntime
                ? `runtime ${selectedRuntime.name} with an outline of the rest of the board`
                : "the whole board"
            }, ${
              settings.includeAssetContents
                ? "including asset contents"
                : "without asset contents"
            }, are sent to ${
              compatible ? settings.openAICompatibleUrl : "Anthropic"
            }.`}
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
          onClose={() => {
            setPreview(null);
            setPendingConnection(null);
          }}
          onApply={(board) =>
            apply(
              { ...preview.entry, board, base: preview.base },
              preview.index,
            )
          }
          connection={
            pendingConnection?.index === preview.index ? (
              <AssistConnectionNotice
                addresses={pendingConnection.addresses}
                busy={busy}
                onAccept={async () => {
                  if (
                    await apply(
                      pendingConnection.entry,
                      pendingConnection.index,
                      true,
                    )
                  )
                    setPreview(null);
                }}
                onCancel={() => setPendingConnection(null)}
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
