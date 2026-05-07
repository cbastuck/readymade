import { useEffect, useRef, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import SecretField from "hkp-frontend/src/components/shared/SecretField";
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

const fieldLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-dim, #9a9590)",
  marginBottom: 5,
  display: "block",
};

function DialogBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className="hkp-svc-btn"
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        border: primary
          ? "1.5px solid var(--hkp-accent, #0abcfb)"
          : "1.5px solid var(--border-mid, #d5d0c8)",
        background: primary ? "var(--hkp-accent, #0abcfb)" : "none",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        color: primary ? "white" : "var(--text-mid, #666)",
        transition: "background 0.15s, color 0.15s, filter 0.15s",
        opacity: disabled ? 0.4 : 1,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (disabled) { return; }
        const el = e.currentTarget as HTMLButtonElement;
        if (primary) {
          el.style.filter = "brightness(0.92)";
        } else {
          el.style.background = "var(--border, #e2ddd7)";
          el.style.color = "var(--text, #1a1a1a)";
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) { return; }
        const el = e.currentTarget as HTMLButtonElement;
        if (primary) {
          el.style.filter = "";
        } else {
          el.style.background = "none";
          el.style.color = "var(--text-mid, #666)";
        }
      }}
    >
      {children}
    </button>
  );
}

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

  const onDialogExplainBoard = async () => {
    const output = getOutputText();
    props.service.configure({ generatedBoardSource: output });
    setLastError("");
    try {
      await props.service.generatePromptFromBoardSource(output);
    } catch (err: any) {
      setLastError(err?.message || `${err}`);
    }
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
          minWidth: 420,
        }}
      >
        {inputBoardSource && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-mid, #666)",
              background: "oklch(0.965 0.005 62)",
              padding: "7px 10px",
              borderRadius: 6,
              lineHeight: 1.4,
            }}
          >
            Refinement mode active: current input board JSON is attached to the
            prompt.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

        <SecretField
          label="API Key"
          value={secretId("uservault", props.service, `apiKey.${provider}`)}
          fallbackValue={apiKey}
          onChange={onChangeApiKey}
        />

        <button
          className="hkp-svc-btn"
          type="button"
          onClick={() => props.service.configure({ isEditorOpen: true })}
          style={{
            width: "100%",
            padding: "6px 14px",
            borderRadius: 8,
            border: "1.5px solid var(--border-mid, #d5d0c8)",
            background: "none",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            color: "var(--text-mid, #666)",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--border, #e2ddd7)";
            el.style.color = "var(--text, #1a1a1a)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "none";
            el.style.color = "var(--text-mid, #666)";
          }}
        >
          Edit Workflow
        </button>

        {lastError && (
          <div
            style={{
              fontSize: 12,
              color: "oklch(0.52 0.18 15)",
              lineHeight: 1.4,
            }}
          >
            {lastError}
          </div>
        )}
      </div>

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => props.service.configure({ isEditorOpen: open })}
      >
        <DialogContent
          style={{
            padding: 0,
            background: "var(--bg-card, white)",
            border: "1px solid var(--border, #e2ddd7)",
            borderRadius: 16,
            boxShadow:
              "0 4px 24px oklch(0.4 0.01 280 / 0.12), 0 1px 4px oklch(0.4 0.01 280 / 0.06)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            width: "95vw",
            maxWidth: "95vw",
            height: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          className="sm:max-w-[95%]"
          aria-describedby="workflow-refiner-editor-description"
        >
          {/* Header */}
          <div
            style={{
              padding: "13px 44px 13px 16px",
              borderBottom: "1px solid var(--border, #e2ddd7)",
              flexShrink: 0,
            }}
          >
            <DialogTitle
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text, #1a1a1a)",
                letterSpacing: 0,
                lineHeight: 1.3,
              }}
            >
              Edit Workflow
            </DialogTitle>
            <DialogDescription
              id="workflow-refiner-editor-description"
              style={{
                fontSize: 11.5,
                color: "var(--text-dim, #9a9590)",
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              Use left-to-right generation (prompt to board JSON) or
              right-to-left generation (board JSON to prompt) to refine quickly.
            </DialogDescription>
          </div>

          {/* Two-column editors */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              background: "var(--border, #e2ddd7)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                background: "var(--bg-card, white)",
              }}
            >
              <div style={{ ...fieldLabel, padding: "10px 14px 0", marginBottom: 0 }}>
                Workflow Prompt
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
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

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                background: "var(--bg-card, white)",
              }}
            >
              <div style={{ ...fieldLabel, padding: "10px 14px 0", marginBottom: 0 }}>
                Current Board JSON
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
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

          {/* Footer */}
          <div
            style={{
              padding: "11px 16px",
              borderTop: "1px solid var(--border, #e2ddd7)",
              display: "flex",
              gap: 6,
              justifyContent: "flex-end",
              flexShrink: 0,
              flexWrap: "wrap",
            }}
          >
            <DialogBtn onClick={onDialogIterate} disabled={busy}>
              {busy ? "Generating…" : "Generate Board JSON"}
            </DialogBtn>
            <DialogBtn
              onClick={onDialogExplainBoard}
              disabled={busy || !getOutputText()?.trim()}
            >
              {busy ? "Generating…" : "Generate Prompt"}
            </DialogBtn>
            <DialogBtn
              onClick={onDialogPush}
              disabled={!getOutputText()?.trim()}
            >
              Push to Output
            </DialogBtn>
            <DialogBtn
              onClick={onDialogApply}
              disabled={!getOutputText()?.trim()}
              primary
            >
              Apply Board
            </DialogBtn>
          </div>
        </DialogContent>
      </Dialog>
    </ServiceUI>
  );
}
