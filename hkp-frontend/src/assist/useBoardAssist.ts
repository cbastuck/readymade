import { useEffect, useRef, useState } from "react";
import { useBoardContext } from "../BoardContext";
import { useNestedNavigation } from "../runtime/ui/NestedNavigation";
import { BoardDescriptor } from "../types";
import { BoardDocuments, linkBoardDocument } from "../core/boardPersistence";
import {
  AssistModel,
  Conversation,
  listAssistModels,
  modelEfforts,
  runAssistTurn,
} from "./anthropic";
import { listOpenAIModels, runOpenAICompatibleTurn } from "./openAICompatible";
import { saveAssistSettings, useAssistSettings } from "./settings";
import { matchesAssistSnapshot } from "./snapshotComparison";
import { validateAssistBoard } from "./validation";
import { captureBoardRenderFailures } from "../core/renderFailures";
import { boardAssistKnowledgeProvider } from "./mcpKnowledge";
import { assistContext, resolveAssistScope } from "./scope";
import {
  hasNewAddresses,
  nameKeptServers,
  newAddresses,
  NewAddresses,
} from "./addresses";

type SavedSnapshot = {
  config: BoardDescriptor;
  units: BoardDocuments["units"];
};
export type AssistEntry = {
  role: "user" | "assistant";
  text: string;
  board?: BoardDescriptor;
  base?: string;
  applied?: boolean;
  rawResponse?: string;
  preflightError?: string;
  preflightPassed?: boolean;
};
export type AssistPreview = {
  current: BoardDescriptor;
  proposed: BoardDescriptor;
  entry: AssistEntry;
  index: number;
  base: string;
  readOnly: boolean;
};

/**
 * What a request is narrowed to when the person chooses "only this runtime":
 * the desktop's selection, or on a phone the runtime and service last opened.
 */
export type AssistFocus = {
  runtimeId: string | null | undefined;
  serviceUuids: string[];
};

/**
 * Board Assist without its layout: the provider's models, the conversation,
 * and proposals previewed, applied and reverted. The desktop panel and the
 * phones' Assist page are two views of this.
 *
 * `active` is whether the view is showing; models are queried only then.
 */
export function useBoardAssist({
  active,
  focus,
}: {
  active: boolean;
  focus: AssistFocus;
}) {
  const board = useBoardContext();
  const currentBoard = useRef(board);
  currentBoard.current = board;
  const navigation = useNestedNavigation();
  const settings = useAssistSettings();
  const compatible = settings.provider === "openai-compatible";
  const providerReady = compatible
    ? !!settings.openAICompatibleUrl.trim()
    : !!settings.anthropicToken.trim();
  const [models, setModels] = useState<AssistModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [entries, setEntries] = useState<AssistEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState("selection");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("");
  const [knowledgeNotice, setKnowledgeNotice] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AssistPreview | null>(null);
  const [previous, setPrevious] = useState<SavedSnapshot | null>(null);
  const [revertEntryIndex, setRevertEntryIndex] = useState<number | null>(null);
  // The board right after the proposal was applied. Reverting when the board
  // has moved on since would discard those later changes, so it asks first.
  // Absent when applying failed half-way: then reverting is the recovery.
  const [appliedSnapshot, setAppliedSnapshot] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<number | null>(null);
  // A proposal waiting for the person to accept addresses it would contact.
  const [pendingConnection, setPendingConnection] = useState<{
    entry: AssistEntry;
    index: number;
    addresses: NewAddresses;
  } | null>(null);
  const conversation = useRef<Conversation>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!active) return;
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
    active,
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

  const model = models.find((item) => item.id === settings.model) ?? models[0];
  const efforts = modelEfforts(model);
  const effort = efforts.includes(settings.effort)
    ? settings.effort
    : "default";
  const updateSettings = (patch: Parameters<typeof saveAssistSettings>[0]) => {
    const failed = () => setError("Could not save assistant preferences.");
    try {
      saveAssistSettings(patch).catch(failed);
    } catch {
      failed();
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
      const editScope = resolveAssistScope(config, scope, focus.runtimeId);
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
          selectedServiceUuids: scope === "board" ? [] : focus.serviceUuids,
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
      const completedEntry: AssistEntry = {
        role: "assistant",
        text: [result.text, renamedNote].filter(Boolean).join("\n\n"),
        board: proposal,
        rawResponse: proposal ? undefined : rawResponse,
        base: JSON.stringify(captured),
        preflightError,
        preflightPassed: !!proposal && !preflightError,
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
          i === index
            ? { role: "assistant", text: message, rawResponse }
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
  const previewChanges = async (entry: AssistEntry, index: number) => {
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
    entry: AssistEntry,
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
    entry: AssistEntry,
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
  /** Applies the board as the preview left it, perhaps edited there. */
  const applyPreview = (edited: BoardDescriptor) =>
    preview
      ? apply({ ...preview.entry, board: edited, base: preview.base }, preview.index)
      : Promise.resolve(false);
  /** Applies the proposal whose new addresses the person accepted. */
  const acceptConnection = async () => {
    if (!pendingConnection) return false;
    const applied = await apply(
      pendingConnection.entry,
      pendingConnection.index,
      true,
    );
    if (applied) setPreview(null);
    return applied;
  };
  const selectedRuntime = board?.runtimes.find(
    (rt) => rt.id === focus.runtimeId,
  );
  const runtimeScoped = scope === "selection" && !!selectedRuntime;
  return {
    settings,
    compatible,
    providerReady,
    models,
    modelsLoading,
    refreshModels: () => setReload((value) => value + 1),
    model,
    efforts,
    effort,
    updateSettings,
    entries,
    prompt,
    setPrompt,
    scope,
    setScope,
    /** The runtime "only this runtime" narrows to, if there is one. */
    selectedRuntime,
    selectedCount: focus.serviceUuids.length,
    busy,
    status,
    knowledgeNotice,
    error,
    send,
    /** Whether a request is in flight that Stop would end. */
    stoppable: !!abort.current,
    stop: () => abort.current?.abort(),
    newConversation: () => {
      forgetConversation();
      setError("");
    },
    preview,
    previewChanges,
    applyPreview,
    closePreview: () => {
      setPreview(null);
      setPendingConnection(null);
    },
    apply,
    revert,
    /** Whether the entry at this index is the one Revert undoes. */
    revertible: (index: number) => revertEntryIndex === index,
    canRevert: !!previous,
    confirmRevert,
    keepCurrentBoard: () => setConfirmRevert(null),
    pendingConnection,
    acceptConnection,
    cancelConnection: () => setPendingConnection(null),
    /** What a request carries and where it goes, said beside the prompt. */
    disclosure: `Your prompt and ${
      runtimeScoped
        ? `runtime ${selectedRuntime!.name} with an outline of the rest of the board`
        : "the whole board"
    }, ${
      settings.includeAssetContents
        ? "including asset contents"
        : "without asset contents"
    }, are sent to ${
      compatible ? settings.openAICompatibleUrl : "Anthropic"
    }.`,
  };
}

export type BoardAssist = ReturnType<typeof useBoardAssist>;
