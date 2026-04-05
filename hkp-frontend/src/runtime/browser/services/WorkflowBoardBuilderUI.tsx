import { useEffect, useRef, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import SecretField from "hkp-frontend/src/components/shared/SecretField";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { assureJSON } from "hkp-frontend/src/common";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { secretId } from "hkp-frontend/src/vault";
import Editor, {
  EditorHandle,
} from "hkp-frontend/src/components/shared/Editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

type Provider = "claude" | "openai" | "gemini";

type State = {
  provider: Provider;
  model: string;
  description: string;
  inputBoardSource: string;
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

export default function WorkflowBoardBuilderUI(props: ServiceUIProps) {
  const boardContext = useBoardContext();

  const [provider, setProvider] = useState<Provider>("claude");
  const [model, setModel] = useState("claude-3-7-sonnet-latest");
  const [description, setDescription] = useState("");
  const [inputBoardSource, setInputBoardSource] = useState("");
  const [generatedBoardSource, setGeneratedBoardSource] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const workflowEditorRef = useRef<EditorHandle | null>(null);
  const outputEditorRef = useRef<EditorHandle | null>(null);

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
    if (needsUpdate(state.inputBoardSource, inputBoardSource)) {
      setInputBoardSource(state.inputBoardSource || "");
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
    } catch (err: any) {
      setLastError(err?.message || `${err}`);
    }
  };

  const onApplyGeneratedBoard = async (source?: string) => {
    const raw = source || generatedBoardSource;
    const parsed = assureJSON(raw);
    await boardContext?.setBoardState(parsed as any);
  };

  const getWorkflowText = () => {
    const value = workflowEditorRef.current?.getValue();
    if (typeof value === "string") {
      return value;
    }
    return description;
  };

  const getOutputText = () => {
    const value = outputEditorRef.current?.getValue();
    if (typeof value === "string") {
      return value;
    }
    return generatedBoardSource;
  };

  const onDialogPush = () => {
    const output = getOutputText();
    props.service.configure({ generatedBoardSource: output });
    try {
      props.service.pushGeneratedBoardToOutput(output);
      setLastError("");
    } catch (err: any) {
      setLastError(err?.message || `${err}`);
    }
  };

  const onDialogApply = async () => {
    const output = getOutputText();
    props.service.configure({ generatedBoardSource: output });
    await onApplyGeneratedBoard(output);
  };

  const onDialogIterate = async () => {
    const workflow = getWorkflowText();
    props.service.configure({ description: workflow });
    await onGenerate(workflow);
  };

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    if (workflowEditorRef.current && typeof description === "string") {
      workflowEditorRef.current.setValue(description);
    }

    if (outputEditorRef.current && typeof generatedBoardSource === "string") {
      outputEditorRef.current.setValue(generatedBoardSource);
    }
  }, [description, generatedBoardSource, isEditorOpen]);

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      className="pb-4"
      initialSize={{ width: 500, height: undefined }}
    >
      <div className="flex flex-col gap-2 w-full min-w-[420px]">
        {inputBoardSource && (
          <div className="text-xs text-neutral-700 bg-neutral-100 p-2 rounded">
            Refinement mode active: current input board JSON is attached to the
            prompt.
          </div>
        )}

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

        <Button
          variant="outline"
          onClick={() => props.service.configure({ isEditorOpen: true })}
        >
          Edit Workflow
        </Button>

        {lastError && <div className="text-red-600 text-sm">{lastError}</div>}
      </div>

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => props.service.configure({ isEditorOpen: open })}
      >
        <DialogContent
          className="sm:max-w-[95%] h-[85vh] flex flex-col"
          aria-describedby="workflow-refiner-editor-description"
        >
          <DialogTitle>Edit Workflow</DialogTitle>
          <DialogDescription
            id="workflow-refiner-editor-description"
            className="text-xs"
          >
            Describe your intended workflow in the editor, or refine a board in
            your words, maybe iterate and when you're finished apply.
          </DialogDescription>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
            <div className="flex flex-col min-h-0">
              <div className="text-xs font-semibold mb-1">Workflow Prompt</div>
              <div className="flex-1 min-h-0">
                <Editor
                  ref={(editor) => {
                    workflowEditorRef.current = editor;
                  }}
                  value={description || ""}
                  language="markdown"
                  autofocus
                />
              </div>
            </div>
            <div className="flex flex-col min-h-0">
              <div className="text-xs font-semibold mb-1">
                Current Board JSON
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  ref={(editor) => {
                    outputEditorRef.current = editor;
                  }}
                  value={generatedBoardSource || ""}
                  language="json"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" disabled={busy} onClick={onDialogIterate}>
              {busy ? "Iterating..." : "Iterate"}
            </Button>
            <Button
              variant="outline"
              disabled={!getOutputText()?.trim()}
              onClick={onDialogPush}
            >
              Push to Output
            </Button>
            <Button
              variant="outline"
              disabled={!getOutputText()?.trim()}
              onClick={onDialogApply}
            >
              Apply Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ServiceUI>
  );
}
