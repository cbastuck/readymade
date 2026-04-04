import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BoardDescriptor,
  RuntimeApiMap,
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
  ServiceUIProps,
  SidechainRouting,
} from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import SecretField from "hkp-frontend/src/components/shared/SecretField";
import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { assureJSON } from "hkp-frontend/src/common";
import BoardProvider, {
  BoardProviderHandle,
  useBoardContext,
} from "hkp-frontend/src/BoardContext";
import { secretId } from "hkp-frontend/src/vault";
import browserRuntimeApi from "../BrowserRuntimeApi";
import remoteRuntimeApi from "../../graphql/RuntimeGraphQLApi";
import runtimeRestApi from "../../rest/RuntimeRestApi";
import Board from "hkp-frontend/src/views/playground/Board";

type Provider = "claude" | "openai" | "gemini";

type DraftEntry = {
  id: string;
  createdAt: string;
  provider: Provider;
  model: string;
  targetRuntime?: string;
  description: string;
  generatedBoardSource: string;
};

type State = {
  provider: Provider;
  model: string;
  description: string;
  generatedBoardSource: string;
  isEditorOpen: boolean;
  busy: boolean;
  lastError: string;
};

const PROVIDER_OPTIONS = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
};

const MODEL_OPTIONS: Record<Provider, Record<string, string>> = {
  claude: {
    "claude-3-7-sonnet-latest": "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-latest": "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest": "claude-3-5-haiku-latest",
  },
  openai: {
    "gpt-4.1-mini": "gpt-4.1-mini",
    "gpt-4.1": "gpt-4.1",
    "gpt-4o-mini": "gpt-4o-mini",
  },
  gemini: {
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-1.5-pro": "gemini-1.5-pro",
  },
};

function PreviewBoardCanvas({
  boardName,
  inputRouting,
  outputRouting,
  sidechainRouting,
}: {
  boardName: string;
  inputRouting: RuntimeInputRoutings;
  outputRouting: RuntimeOutputRoutings;
  sidechainRouting: SidechainRouting;
}) {
  const embeddedBoardContext = useBoardContext();
  if (!embeddedBoardContext) {
    return null;
  }

  return (
    <Board
      inputRouting={inputRouting}
      outputRouting={outputRouting}
      boardContext={embeddedBoardContext}
      sidechainRouting={sidechainRouting}
      boardName={boardName}
      onChangeOutputRouting={() => {}}
      onChangeInputRouting={() => {}}
      onChangeSidechainRouting={() => {}}
    />
  );
}

export default function WorkflowBoardBuilderUI(props: ServiceUIProps) {
  const boardContext = useBoardContext();
  const previewRuntimeApis = useMemo<RuntimeApiMap>(
    () => ({
      browser: browserRuntimeApi,
      remote: remoteRuntimeApi,
      graphql: remoteRuntimeApi,
      realtime: runtimeRestApi,
      rest: runtimeRestApi,
    }),
    [],
  );

  const [provider, setProvider] = useState<Provider>("claude");
  const [model, setModel] = useState("claude-3-7-sonnet-latest");
  const [description, setDescription] = useState("");
  const [generatedBoardSource, setGeneratedBoardSource] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [showGeneratedDialog, setShowGeneratedDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [drafts, setDrafts] = useState<Array<DraftEntry>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewBoardName, setPreviewBoardName] = useState("Generated Preview");
  const [previewInputRouting, setPreviewInputRouting] =
    useState<RuntimeInputRoutings>({});
  const [previewOutputRouting, setPreviewOutputRouting] =
    useState<RuntimeOutputRoutings>({});
  const [previewSidechainRouting, setPreviewSidechainRouting] =
    useState<SidechainRouting>({});
  const previewBoardProviderRef = useRef<BoardProviderHandle | null>(null);

  const update = (state: Partial<State>) => {
    if (needsUpdate(state.provider, provider)) {
      setProvider(state.provider as Provider);
    }
    if (needsUpdate(state.model, model)) {
      setModel(state.model || "");
    }
    if (needsUpdate(state.description, description)) {
      setDescription(state.description || "");
    }
    if (needsUpdate(state.generatedBoardSource, generatedBoardSource)) {
      setGeneratedBoardSource(state.generatedBoardSource || "");
    }
    if (needsUpdate(state.isEditorOpen, isEditorOpen)) {
      setIsEditorOpen(!!state.isEditorOpen);
    }
    if (needsUpdate(state.busy, busy)) {
      setBusy(!!state.busy);
    }
    if (needsUpdate(state.lastError, lastError)) {
      setLastError(state.lastError || "");
    }
    if (needsUpdate((state as any).apiKey, apiKey)) {
      setApiKey((state as any).apiKey || "");
    }
  };

  const onInit = (initialState: Partial<State>) => {
    update(initialState);
    setDrafts(loadDrafts(props.service.uuid));
  };

  const onNotification = (state: Partial<State>) => {
    update(state);
  };

  const onProviderChanged = ({ value }: { value: string }) => {
    props.service.configure({ provider: value });
  };

  const onModelChanged = ({ value }: { value: string }) => {
    props.service.configure({ model: value });
  };

  const onChangeApiKey = (value: string) => {
    props.service.configure({ apiKey: value });
  };

  const onGenerate = async (workflowDescription?: string) => {
    const useDescription = workflowDescription ?? description;
    props.service.configure({ description: useDescription });
    setLastError("");
    try {
      await props.service.generateBoardFromDescription(useDescription);
      setShowGeneratedDialog(true);
    } catch (err: any) {
      setLastError(err?.message || `${err}`);
    }
  };

  const onApplyGeneratedBoard = async (source?: string) => {
    const raw = source || generatedBoardSource;
    const parsed = assureJSON(raw);
    await boardContext?.setBoardState(parsed as any);
  };

  const onPushGeneratedBoard = () => {
    try {
      props.service.pushGeneratedBoardToOutput(generatedBoardSource);
      setLastError("");
    } catch (err: any) {
      setLastError(err?.message || `${err}`);
    }
  };

  const buildPreviewBoard = useCallback((): BoardDescriptor => {
    if (!generatedBoardSource) {
      throw new Error("No generated board JSON available for preview");
    }

    const parsed = assureJSON(generatedBoardSource) as any;
    if (!parsed || !Array.isArray(parsed.runtimes) || !parsed.services) {
      throw new Error("Generated JSON does not look like a board descriptor");
    }

    setPreviewBoardName(parsed.boardName || "Generated Preview");
    setPreviewInputRouting(parsed.inputRouting || {});
    setPreviewOutputRouting(parsed.outputRouting || {});
    setPreviewSidechainRouting(parsed.sidechainRouting || {});

    return {
      boardName: parsed.boardName || "Generated Preview",
      runtimes: parsed.runtimes,
      services: parsed.services,
      registry: parsed.registry || {},
    };
  }, [generatedBoardSource]);

  const onTogglePreview = async () => {
    const next = !showPreview;
    setShowPreview(next);

    if (!next) {
      return;
    }

    try {
      buildPreviewBoard();
      setPreviewError("");
      setTimeout(() => previewBoardProviderRef.current?.fetchBoard(), 0);
    } catch (err: any) {
      setPreviewError(err?.message || `${err}`);
      setShowPreview(false);
    }
  };

  useEffect(() => {
    if (!showPreview || !generatedBoardSource) {
      return;
    }

    try {
      buildPreviewBoard();
      setPreviewError("");
      previewBoardProviderRef.current?.fetchBoard();
    } catch (err: any) {
      setPreviewError(err?.message || `${err}`);
    }
  }, [generatedBoardSource, showPreview, buildPreviewBoard]);

  const onSaveDraft = (workflowDescription?: string) => {
    const entry: DraftEntry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      provider,
      model,
      description: workflowDescription ?? description,
      generatedBoardSource,
    };

    const updated = [entry, ...drafts].slice(0, 30);
    setDrafts(updated);
    storeDrafts(props.service.uuid, updated);
    setSelectedDraftId(entry.id);
  };

  const onLoadDraft = ({ value }: { value: string }) => {
    setSelectedDraftId(value);
    const draft = drafts.find((d) => d.id === value);
    if (!draft) {
      return;
    }

    props.service.configure({
      provider: draft.provider,
      model: draft.model,
      description: draft.description,
      generatedBoardSource: draft.generatedBoardSource,
      isEditorOpen: true,
    });
    setShowGeneratedDialog(!!draft.generatedBoardSource);
  };

  const namedDrafts = useMemo(() => {
    return drafts.reduce<Record<string, string>>((all, draft, index) => {
      const name = `Draft ${index + 1}`;
      return {
        ...all,
        [draft.id]: `${name} (${new Date(draft.createdAt).toLocaleString()})`,
      };
    }, {});
  }, [drafts]);

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      className="pb-4"
      initialSize={{ width: 500, height: undefined }}
    >
      <div className="flex flex-col gap-2 w-full min-w-[420px]">
        <div className="text-sm">
          Describe your intended workflow in the editor, generate a board JSON,
          apply it, then iterate. A starter hello-world draft is preloaded so
          preview works immediately.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SelectorField
            label="Provider"
            value={provider}
            options={PROVIDER_OPTIONS}
            onChange={onProviderChanged}
          />
          <SelectorField
            label="Model"
            value={model}
            options={MODEL_OPTIONS[provider]}
            onChange={onModelChanged}
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <SecretField
            label="API Key"
            value={secretId("uservault", props.service, `apiKey.${provider}`)}
            fallbackValue={apiKey}
            onChange={onChangeApiKey}
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <SelectorField
            label="Load Draft"
            value={selectedDraftId || null}
            options={namedDrafts}
            onChange={onLoadDraft}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => props.service.configure({ isEditorOpen: true })}
          >
            Open Workflow Editor
          </Button>
          <Button
            variant="outline"
            disabled={busy || !description}
            onClick={() => onGenerate()}
          >
            {busy ? "Generating..." : "Generate Board JSON"}
          </Button>
          <Button
            variant="outline"
            disabled={!generatedBoardSource}
            onClick={() => setShowGeneratedDialog(true)}
          >
            View Generated JSON
          </Button>
          <Button
            variant="outline"
            disabled={!generatedBoardSource}
            onClick={() => onApplyGeneratedBoard()}
          >
            Apply To Current Board
          </Button>
          <Button
            variant="outline"
            disabled={!generatedBoardSource}
            onClick={onPushGeneratedBoard}
          >
            Push JSON To Output
          </Button>
          <Button
            variant="outline"
            disabled={!generatedBoardSource}
            onClick={onTogglePreview}
          >
            {showPreview ? "Hide WYSIWYG Preview" : "Preview WYSIWYG"}
          </Button>
        </div>

        {lastError && <div className="text-red-600 text-sm">{lastError}</div>}
        {previewError && (
          <div className="text-red-600 text-sm">{previewError}</div>
        )}

        {showPreview && (
          <div className="border border-neutral-300 mt-2 h-[420px] overflow-auto">
            <BoardProvider
              ref={previewBoardProviderRef}
              fetchBoard={async () => buildPreviewBoard()}
              runtimeApis={previewRuntimeApis}
              user={props.service.app.getAuthenticatedUser()}
              boardName={previewBoardName}
              availableRuntimeEngines={[]}
            >
              <PreviewBoardCanvas
                boardName={previewBoardName}
                inputRouting={previewInputRouting}
                outputRouting={previewOutputRouting}
                sidechainRouting={previewSidechainRouting}
              />
            </BoardProvider>
          </div>
        )}
      </div>

      <EditorDialog
        title="Workflow Description"
        description="Describe the desired workflow in natural language."
        isOpen={isEditorOpen}
        value={description || ""}
        language="markdown"
        onClose={() => props.service.configure({ isEditorOpen: false })}
        actions={[
          {
            label: "Generate Board JSON",
            onAction: (v) =>
              onGenerate(typeof v === "string" ? v : JSON.stringify(v)),
          },
          {
            label: "Save Draft",
            onAction: (v) =>
              onSaveDraft(typeof v === "string" ? v : JSON.stringify(v)),
          },
        ]}
      />

      <EditorDialog
        title="Generated Board JSON"
        description="Inspect and optionally edit generated board JSON before applying."
        isOpen={showGeneratedDialog}
        value={generatedBoardSource || "{}"}
        language="json"
        onClose={() => setShowGeneratedDialog(false)}
        actions={[
          {
            label: "Apply Board",
            onAction: async (v) => {
              await onApplyGeneratedBoard(
                typeof v === "string" ? v : JSON.stringify(v),
              );
            },
          },
          {
            label: "Store As Draft",
            onAction: (v) => {
              props.service.configure({
                generatedBoardSource:
                  typeof v === "string" ? v : JSON.stringify(v, null, 2),
              });
              onSaveDraft();
            },
          },
        ]}
      />
    </ServiceUI>
  );
}

function storageKey(serviceUuid: string) {
  return `hkp-ai-workflow-drafts-${serviceUuid}`;
}

function loadDrafts(serviceUuid: string): Array<DraftEntry> {
  const raw = localStorage.getItem(storageKey(serviceUuid));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function storeDrafts(serviceUuid: string, drafts: Array<DraftEntry>) {
  localStorage.setItem(storageKey(serviceUuid), JSON.stringify(drafts));
}
