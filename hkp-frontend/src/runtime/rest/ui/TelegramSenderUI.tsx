import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function TelegramSenderUI(props: ServiceUIProps) {
  const [botToken, setBotToken] = useState("");
  // The server masks the bot token (write-only); this flag tells us one is stored.
  const [botTokenConfigured, setBotTokenConfigured] = useState(false);
  const [chatId, setChatId] = useState("");
  const [error, setError] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.botToken !== undefined) setBotToken(state.botToken);
    if (state.botTokenConfigured !== undefined) {
      setBotTokenConfigured(state.botTokenConfigured);
    }
    if (state.chatId !== undefined) setChatId(state.chatId);
    if (state.error !== undefined) setError(state.error);
  }, []);

  const configure = (patch: Record<string, unknown>) => {
    props.service.configure(patch);
  };

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col">
        <InputField
          label={botTokenConfigured ? "Bot Token (stored)" : "Bot Token"}
          type="password"
          value={botToken}
          onChange={(v) => {
            setBotToken(v);
            if (v) {
              setBotTokenConfigured(true);
            }
            configure({ botToken: v });
          }}
        />

        <InputField
          label="Chat ID"
          value={chatId}
          onChange={(v) => {
            setChatId(v);
            configure({ chatId: v });
          }}
        />

        {error && <div className="text-xs text-red-500 break-all">{error}</div>}
      </div>
    </RuntimeRestServiceUI>
  );
}
