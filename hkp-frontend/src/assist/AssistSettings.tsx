import { useEffect, useRef, useState } from "react";
import {
  RemoveButton,
  SettingsCard,
  SettingsChoices,
  SettingsField,
  SettingsInput,
  SettingsNote,
  SettingsSection,
  SettingsStack,
} from "../ui-components/settings/kit";
import {
  AssistSettings as Settings,
  readAssistSettings,
  saveAssistSettings,
  useAssistSettings,
} from "./settings";
import { normalizeMcpKnowledgeUrl } from "./mcpKnowledge";
import { unencryptedRemote } from "./addresses";

type TextField =
  | "anthropicToken"
  | "openAICompatibleToken"
  | "openAICompatibleUrl"
  | "openAIContextTokens"
  | "mcpKnowledgeUrl";

/** What a text field's draft becomes when it is saved, or why it cannot be. */
function parse(field: TextField, draft: string): Partial<Settings> {
  const value = draft.trim();
  switch (field) {
    case "openAICompatibleUrl": {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Use an HTTP or HTTPS API base URL.");
      return { openAICompatibleUrl: value };
    }
    case "openAIContextTokens": {
      const tokens = Number(value);
      if (!Number.isInteger(tokens) || tokens < 4096)
        throw new Error("Set a context size of at least 4096 tokens.");
      return { openAIContextTokens: tokens };
    }
    case "mcpKnowledgeUrl":
      if (value) normalizeMcpKnowledgeUrl(value);
      return { mcpKnowledgeUrl: value };
    default:
      return { [field]: value };
  }
}

/** Changing where requests go or who makes them invalidates the chosen model. */
const resetsModel = new Set<TextField>([
  "anthropicToken",
  "openAICompatibleToken",
  "openAICompatibleUrl",
]);

/**
 * Board Assist's provider settings. Like Appearance, a change takes effect as
 * it is made: a choice at once, a text field when it is left (or the dialog is
 * closed) — not on every keystroke, since the panel re-queries models and
 * clears its conversation when the provider or server changes.
 */
export default function AssistSettings() {
  const settings = useAssistSettings();
  const draftFrom = (from: Settings): Record<TextField, string> => ({
    anthropicToken: from.anthropicToken,
    openAICompatibleToken: from.openAICompatibleToken,
    openAICompatibleUrl: from.openAICompatibleUrl,
    openAIContextTokens: String(from.openAIContextTokens),
    mcpKnowledgeUrl: from.mcpKnowledgeUrl,
  });
  const [drafts, setDrafts] = useState(() => draftFrom(settings));
  const [errors, setErrors] = useState<Partial<Record<TextField, string>>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const persist = (patch: Partial<Settings>) => {
    try {
      saveAssistSettings(patch);
      return true;
    } catch {
      return false;
    }
  };

  /** Saves a field's draft if it differs from what is saved. */
  const commit = (field: TextField, draft = draftsRef.current[field]) => {
    let patch: Partial<Settings>;
    try {
      patch = parse(field, draft);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [field]: error instanceof Error ? error.message : "Invalid value.",
      }));
      return;
    }
    setErrors((current) => ({ ...current, [field]: undefined }));
    const saved = readAssistSettings();
    const changed = Object.entries(patch).some(
      ([key, value]) => saved[key as keyof Settings] !== value,
    );
    if (!changed) return;
    if (
      !persist({ ...patch, ...(resetsModel.has(field) ? { model: "" } : {}) })
    )
      setErrors((current) => ({
        ...current,
        [field]: "Could not save on this device.",
      }));
  };

  // Escape closes the dialog without blurring the focused field; keep what was
  // typed. Invalid drafts are dropped, as they would be on blur.
  useEffect(
    () => () => {
      for (const field of Object.keys(draftsRef.current) as TextField[]) {
        try {
          const patch = parse(field, draftsRef.current[field]);
          const saved = readAssistSettings();
          if (
            Object.entries(patch).some(
              ([key, value]) => saved[key as keyof Settings] !== value,
            )
          )
            persist({
              ...patch,
              ...(resetsModel.has(field) ? { model: "" } : {}),
            });
        } catch {
          /* Not valid: nothing to keep. */
        }
      }
    },
    [],
  );

  const text = (field: TextField) => ({
    value: drafts[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDrafts((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    onBlur: () => commit(field),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") commit(field);
    },
    "aria-invalid": !!errors[field] || undefined,
  });
  const error = (field: TextField) =>
    errors[field] && (
      <p className="hkp-set-error" role="alert">
        {errors[field]}
      </p>
    );
  const removeToken = (field: "anthropicToken" | "openAICompatibleToken") => {
    setDrafts((current) => ({ ...current, [field]: "" }));
    persist({ [field]: "", model: "" });
  };

  return (
    <SettingsStack>
      {/* One frame for the choice and what it switches between, so what follows
          it — the knowledge server — reads as shared by both providers. */}
      <SettingsCard>
        <SettingsStack>
          <SettingsSection label="Provider">
            <SettingsChoices
              options={[
                { id: "anthropic", label: "Anthropic", sub: "Hosted API" },
                {
                  id: "openai-compatible",
                  label: "OpenAI compatible",
                  sub: "llama.cpp or any compatible server",
                },
              ]}
              value={settings.provider}
              onChange={(provider) => persist({ provider, model: "" })}
            />
          </SettingsSection>

          {settings.provider === "anthropic" ? (
            <SettingsSection
              label="Anthropic"
              hint="Models are queried from Anthropic with your API token."
              action={
                settings.anthropicToken && (
                  <RemoveButton
                    label="Remove Anthropic token"
                    onClick={() => removeToken("anthropicToken")}
                  />
                )
              }
            >
              <SettingsField label="API token">
                <SettingsInput
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-ant-…"
                  {...text("anthropicToken")}
                />
              </SettingsField>
            </SettingsSection>
          ) : (
            <>
              <SettingsSection
                label="Server"
                hint="A local server such as llama.cpp, or a hosted OpenAI-compatible endpoint. The token is optional for servers without authentication."
                action={
                  settings.openAICompatibleToken && (
                    <RemoveButton
                      label="Remove server token"
                      onClick={() => removeToken("openAICompatibleToken")}
                    />
                  )
                }
              >
                <SettingsField label="API base URL">
                  <SettingsInput
                    type="url"
                    spellCheck={false}
                    placeholder="http://127.0.0.1:8081/v1"
                    {...text("openAICompatibleUrl")}
                  />
                </SettingsField>
                {error("openAICompatibleUrl")}
                {unencryptedRemote(drafts.openAICompatibleUrl) && (
                  <SettingsNote tone="warn">
                    This is plain HTTP to another machine. The API token, your
                    prompts and your board cross the network unencrypted. Use
                    HTTPS unless the network between you and the server is
                    trusted.
                  </SettingsNote>
                )}
                <SettingsField label="API token">
                  <SettingsInput
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    {...text("openAICompatibleToken")}
                  />
                </SettingsField>
              </SettingsSection>
              <SettingsSection
                label="Thinking mode (llama.cpp)"
                hint="Off sends enable_thinking: false to llama.cpp, On sends true. Leave Server default for endpoints without llama.cpp's chat-template options."
              >
                <SettingsChoices
                  options={[
                    { id: "default", label: "Server default" },
                    { id: "off", label: "Off" },
                    { id: "on", label: "On" },
                  ]}
                  value={settings.openAIThinking}
                  onChange={(openAIThinking) => persist({ openAIThinking })}
                />
              </SettingsSection>
              <SettingsSection
                label="Server context size"
                hint="Match the server's context limit, for example 8192 for llama-server -c 8192. Larger boards may need a larger context on both sides."
              >
                <SettingsField label="Tokens">
                  <SettingsInput
                    type="number"
                    min={4096}
                    step={1024}
                    {...text("openAIContextTokens")}
                  />
                </SettingsField>
                {error("openAIContextTokens")}
              </SettingsSection>
            </>
          )}
        </SettingsStack>
      </SettingsCard>

      <SettingsSection
        label="Knowledge server"
        hint="Optional MCP endpoint for richer, version-labelled Readymade knowledge, used with either provider. Leave it empty to use only the documentation bundled with this app; Board Assist also falls back to that whenever the server is unavailable."
      >
        <SettingsField label="MCP server URL">
          <SettingsInput
            type="url"
            spellCheck={false}
            placeholder="http://127.0.0.1:8787/mcp"
            {...text("mcpKnowledgeUrl")}
          />
        </SettingsField>
        {error("mcpKnowledgeUrl")}
        {unencryptedRemote(drafts.mcpKnowledgeUrl) && (
          <SettingsNote tone="warn">
            This is plain HTTP to another machine. Search terms and boards sent
            for validation cross the network unencrypted.
          </SettingsNote>
        )}
      </SettingsSection>

      <SettingsNote>
        Tokens and URLs stay in this device's local storage, never in a board.
        Your prompt and board context go to the selected provider — see the
        Board assistant documentation for exactly what is sent where.
      </SettingsNote>
    </SettingsStack>
  );
}
