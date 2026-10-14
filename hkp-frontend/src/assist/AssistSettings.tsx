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

export default function AssistSettings() {
  const settings = useAssistSettings();
  const [anthropic, setAnthropic] = useState(settings.anthropicToken);
  const [openAI, setOpenAI] = useState(settings.openAICompatibleToken);
  const [url, setUrl] = useState(settings.openAICompatibleUrl);
  const [feedback, setFeedback] = useState("");
  const save = () => {
    try {
      saveAssistSettings({
        anthropicToken: anthropic.trim(),
        openAICompatibleToken: openAI.trim(),
        openAICompatibleUrl: url.trim(),
        ...(anthropic.trim() !== settings.anthropicToken ? { model: "" } : {}),
      });
      setFeedback("Saved on this device.");
    } catch {
      setFeedback("Could not save settings. Device storage is unavailable.");
    }
  };
  return (
    <SettingsStack>
      <SettingsSection
        label="Anthropic"
        hint="Used by the board assistant. Models are queried from Anthropic with your API token."
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
        hint="Credentials can be saved here for a future provider integration. The assistant currently uses Anthropic."
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
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setFeedback("");
            }}
          />
        </SettingsField>
      </SettingsSection>
      <SettingsNote>
        Tokens are stored in this browser or app's local storage on this device,
        outside board files. Requests go directly to Anthropic. Your prompts,
        board configuration and relevant documentation are sent to the provider.
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
