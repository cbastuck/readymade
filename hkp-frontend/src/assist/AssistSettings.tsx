import { useState } from "react";
import {
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsNote,
  SettingsSection,
  SettingsStack,
} from "../ui-components/settings/kit";
import { saveAssistSettings, useAssistSettings } from "./settings";
import { normalizeMcpKnowledgeUrl } from "./mcpKnowledge";
import { unencryptedRemote } from "./addresses";

export default function AssistSettings() {
  const settings = useAssistSettings();
  const [anthropic, setAnthropic] = useState(settings.anthropicToken);
  const [openAI, setOpenAI] = useState(settings.openAICompatibleToken);
  const [thinking, setThinking] = useState(settings.openAIThinking);
  const [provider, setProvider] = useState(settings.provider);
  const [contextTokens, setContextTokens] = useState(
    settings.openAIContextTokens,
  );
  const [url, setUrl] = useState(settings.openAICompatibleUrl);
  const [mcpUrl, setMcpUrl] = useState(settings.mcpKnowledgeUrl);
  const [feedback, setFeedback] = useState("");
  const save = () => {
    try {
      if (provider === "openai-compatible") {
        const endpoint = new URL(url.trim());
        if (!["http:", "https:"].includes(endpoint.protocol))
          throw new Error("Use an HTTP or HTTPS API base URL.");
        if (!Number.isInteger(contextTokens) || contextTokens < 4096)
          throw new Error("Set a context size of at least 4096 tokens.");
      }
      if (mcpUrl.trim()) normalizeMcpKnowledgeUrl(mcpUrl);
      saveAssistSettings({
        provider,
        openAIContextTokens: contextTokens,
        openAIThinking: thinking,
        anthropicToken: anthropic.trim(),
        openAICompatibleToken: openAI.trim(),
        openAICompatibleUrl: url.trim(),
        mcpKnowledgeUrl: mcpUrl.trim(),
        ...(anthropic.trim() !== settings.anthropicToken ||
        provider !== settings.provider ||
        url.trim() !== settings.openAICompatibleUrl
          ? { model: "" }
          : {}),
      });
      setFeedback("Saved on this device.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    }
  };
  return (
    <SettingsStack>
      <SettingsSection label="Provider">
        <SettingsField label="Board Assist provider">
          <select
            className="hkp-set-input"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as typeof provider);
              setFeedback("");
            }}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai-compatible">OpenAI compatible</option>
          </select>
        </SettingsField>
      </SettingsSection>
      <SettingsSection
        label="Anthropic"
        hint="Used by Board Assist. Models are queried from Anthropic with your API token."
      >
        <SettingsField label="API token">
          <SettingsInput
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={anthropic}
            onChange={(event) => {
              setAnthropic(event.target.value);
              setFeedback("");
            }}
            placeholder="sk-ant-…"
          />
        </SettingsField>
      </SettingsSection>
      <SettingsSection
        label="OpenAI compatible"
        hint="Connect to a local server such as llama.cpp, or a hosted OpenAI-compatible endpoint. The token is optional for servers without authentication."
      >
        <SettingsField label="API token">
          <SettingsInput
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={openAI}
            onChange={(event) => {
              setOpenAI(event.target.value);
              setFeedback("");
            }}
          />
        </SettingsField>
        <SettingsField label="API base URL">
          <SettingsInput
            type="url"
            placeholder="http://127.0.0.1:8081/v1"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setFeedback("");
            }}
          />
        </SettingsField>
        {unencryptedRemote(url) && (
          <SettingsNote tone="warn">
            This is plain HTTP to another machine. The API token, your prompts
            and your board cross the network unencrypted. Use HTTPS unless the
            network between you and the server is trusted.
          </SettingsNote>
        )}
        <SettingsField label="Thinking mode (llama.cpp)">
          <select
            className="hkp-set-input"
            value={thinking}
            onChange={(event) => {
              setThinking(event.target.value as typeof thinking);
              setFeedback("");
            }}
          >
            <option value="default">Server default</option>
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </SettingsField>
        <p className="hkp-set-hint">
          Off sends enable_thinking: false to llama.cpp. Leave Server default
          for endpoints that do not support llama.cpp chat-template options.
        </p>
        <SettingsField label="Server context size (tokens)">
          <SettingsInput
            type="number"
            min={4096}
            step={1024}
            value={contextTokens}
            onChange={(event) => {
              setContextTokens(Number(event.target.value));
              setFeedback("");
            }}
          />
        </SettingsField>
        <p className="hkp-set-hint">
          Match the server's context limit, for example 8192 for llama-server -c
          8192. Larger boards may need a larger context on both sides.
        </p>
      </SettingsSection>
      <SettingsSection
        label="Knowledge server"
        hint="Optional MCP endpoint for richer, version-labelled Readymade knowledge. Board Assist falls back to its bundled documentation whenever this server is absent or unavailable."
      >
        <SettingsField label="MCP server URL">
          <SettingsInput
            type="url"
            placeholder="http://127.0.0.1:8787/mcp"
            value={mcpUrl}
            onChange={(event) => {
              setMcpUrl(event.target.value);
              setFeedback("");
            }}
          />
        </SettingsField>
        {unencryptedRemote(mcpUrl) && (
          <SettingsNote tone="warn">
            This is plain HTTP to another machine. Search terms and boards sent
            for validation cross the network unencrypted.
          </SettingsNote>
        )}
        <p className="hkp-set-hint">
          Leave empty to use only the documentation bundled with this app.
          The URL is stored on this device, never in a board.
        </p>
      </SettingsSection>
      <SettingsNote>
        Tokens are stored in this browser or app's local storage on this device,
        outside board files. Requests go directly to the selected provider or
        server. Your prompts, board configuration and relevant documentation are
        sent to the provider: the whole board, or the selected runtime with an
        outline of the rest, and asset contents only when you include them.
        When MCP knowledge is configured, search terms,
        requested paths and richer tool arguments—including a board passed for
        validation—are sent to that endpoint, but provider API tokens are not.
        Applying a board can start services and request device permissions.
      </SettingsNote>
      <div className="hkp-set-inline">
        <SettingsButton onClick={save}>Save</SettingsButton>
        <SettingsButton
          onClick={() => {
            setAnthropic("");
            setOpenAI("");
            try {
              saveAssistSettings({
                anthropicToken: "",
                openAICompatibleToken: "",
                model: "",
              });
              setFeedback("Tokens removed.");
            } catch {
              setFeedback("Could not remove tokens.");
            }
          }}
        >
          Remove tokens
        </SettingsButton>
      </div>
      {feedback && (
        <p role="status" className="hkp-set-hint">
          {feedback}
        </p>
      )}
    </SettingsStack>
  );
}
