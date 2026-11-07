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
  ASSIST_SETTINGS_SECTION,
  ASSIST_TOKEN_ALIASES,
  AssistSettings as Settings,
  assistTokensInVault,
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
  | "openCodeUrl"
  | "openCodeUsername"
  | "openCodePassword"
  | "openAIContextTokens"
  | "mcpKnowledgeUrl";

/** What a text field's draft becomes when it is saved, or why it cannot be. */
function parse(field: TextField, draft: string): Partial<Settings> {
  const value = draft.trim();
  switch (field) {
    case "openAICompatibleUrl":
    case "openCodeUrl": {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Use an HTTP or HTTPS API base URL.");
      return { [field]: value };
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
  "openCodeUrl",
  "openCodeUsername",
  "openCodePassword",
]);

/**
 * Board Assist's provider settings. Like Appearance, a change takes effect as
 * it is made: a choice at once, a text field when it is left (or the dialog is
 * closed) — not on every keystroke, since the panel re-queries models and
 * clears its conversation when the provider or server changes.
 */
export { ASSIST_SETTINGS_SECTION };

export default function AssistSettings() {
  const settings = useAssistSettings();
  const browserOrigin =
    typeof window === "undefined"
      ? "the Readymade app origin"
      : window.location.origin;
  const draftFrom = (from: Settings): Record<TextField, string> => ({
    anthropicToken: from.anthropicToken,
    openAICompatibleToken: from.openAICompatibleToken,
    openAICompatibleUrl: from.openAICompatibleUrl,
    openCodeUrl: from.openCodeUrl,
    openCodeUsername: from.openCodeUsername,
    openCodePassword: from.openCodePassword,
    openAIContextTokens: String(from.openAIContextTokens),
    mcpKnowledgeUrl: from.mcpKnowledgeUrl,
  });
  const [drafts, setDrafts] = useState(() => draftFrom(settings));
  const [errors, setErrors] = useState<Partial<Record<TextField, string>>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  /** Saves, and says beside `field` when this device could not keep it. */
  const persist = (patch: Partial<Settings>, field?: TextField) => {
    const failed = () => {
      if (field)
        setErrors((current) => ({
          ...current,
          [field]: "Could not save on this device.",
        }));
    };
    try {
      saveAssistSettings(patch).catch(failed);
    } catch {
      failed();
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
    persist(
      { ...patch, ...(resetsModel.has(field) ? { model: "" } : {}) },
      field,
    );
  };

  // A dialog can close, or a page can reload, without blurring its focused
  // field. Keep valid drafts in both cases. Invalid drafts are dropped, as
  // they would be on blur.
  useEffect(
    () => {
      const persistDrafts = () => {
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
      };
      window.addEventListener("pagehide", persistDrafts);
      return () => {
        window.removeEventListener("pagehide", persistDrafts);
        persistDrafts();
      };
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
  const removeToken = (
    field: "anthropicToken" | "openAICompatibleToken" | "openCodePassword",
  ) => {
    setDrafts((current) => ({ ...current, [field]: "" }));
    persist({ [field]: "", model: "" }, field);
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
                {
                  id: "opencode",
                  label: "OpenCode server",
                  sub: "a local opencode serve instance",
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
              {error("anthropicToken")}
            </SettingsSection>
          ) : settings.provider === "opencode" ? (
            <>
              <SettingsSection
                label="OpenCode server"
                hint="Uses OpenCode's local model catalog and stateless text-generation API. Configure providers and models in OpenCode first."
                action={
                  settings.openCodePassword && (
                    <RemoveButton
                      label="Remove OpenCode server password"
                      onClick={() => removeToken("openCodePassword")}
                    />
                  )
                }
              >
                <SettingsField label="Server URL">
                  <SettingsInput
                    type="url"
                    spellCheck={false}
                    placeholder="http://127.0.0.1:4096"
                    {...text("openCodeUrl")}
                  />
                </SettingsField>
                {error("openCodeUrl")}
                {unencryptedRemote(drafts.openCodeUrl) && (
                  <SettingsNote tone="warn">
                    This is plain HTTP to another machine. Your password,
                    prompts and board cross the network unencrypted. Use HTTPS
                    unless the network between you and the server is trusted.
                  </SettingsNote>
                )}
                <SettingsField label="Server username">
                  <SettingsInput
                    autoComplete="username"
                    spellCheck={false}
                    {...text("openCodeUsername")}
                  />
                </SettingsField>
                {error("openCodeUsername")}
                <SettingsField label="Server password">
                  <SettingsInput
                    type="password"
                    autoComplete="current-password"
                    spellCheck={false}
                    {...text("openCodePassword")}
                  />
                </SettingsField>
                {error("openCodePassword")}
                <SettingsNote>
                  Start the server with <code>opencode serve --cors {browserOrigin}</code>.
                  The username is <code>opencode</code> unless you set
                  <code>OPENCODE_SERVER_USERNAME</code>. A password is needed
                  only when the server uses <code>OPENCODE_SERVER_PASSWORD</code>.
                </SettingsNote>
              </SettingsSection>
              <SettingsSection
                label="Server context size"
                hint="Match the selected OpenCode model's context limit. Larger boards may need a larger context on both sides."
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
                {error("openAICompatibleToken")}
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
        {assistTokensInVault() ? (
          <>
            Tokens are kept with this device's secrets, as{" "}
            <code>{ASSIST_TOKEN_ALIASES.anthropicToken}</code> and{" "}
            <code>{ASSIST_TOKEN_ALIASES.openAICompatibleToken}</code> and{" "}
            <code>{ASSIST_TOKEN_ALIASES.openCodePassword}</code>, each allowed
            only to its provider's host. URLs stay in this device's local
            storage. Neither is ever written into a board.
          </>
        ) : (
          "Tokens and URLs stay in this device's local storage, never in a board."
        )}{" "}
        Your prompt and board context go to the selected provider — see the
        Board assistant documentation for exactly what is sent where.
      </SettingsNote>
    </SettingsStack>
  );
}
