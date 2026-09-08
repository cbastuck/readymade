import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function TelegramSenderUI(props: ServiceUIProps) {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [error, setError] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.botToken !== undefined) setBotToken(state.botToken);
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
        {/* Not masked: this field holds the *name* of a secret, not a secret.
            The value lives in the vault and is fetched when the API is called,
            so hiding what is typed here would hide nothing and make a mistyped
            alias impossible to spot. */}
        <InputField
          label="Bot token secret"
          value={botToken}
          onChange={(v) => {
            setBotToken(v);
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
