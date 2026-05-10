import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";

export default function TelegramListenerUI(props: ServiceUIProps) {
  const [botToken, setBotToken] = useState("");
  const [allowedChatId, setAllowedChatId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.botToken !== undefined) setBotToken(state.botToken);
    if (state.allowedChatId !== undefined)
      setAllowedChatId(state.allowedChatId);
    if (state.running !== undefined) setRunning(state.running);
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
          label="Bot Token"
          type="password"
          value={botToken}
          onChange={(v) => {
            setBotToken(v);
            configure({ botToken: v });
          }}
        />

        <InputField
          label="Allowed Chat ID"
          value={allowedChatId}
          onChange={(v) => {
            setAllowedChatId(v);
            configure({ allowedChatId: v });
          }}
        />

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="hkp-svc-btn"
            onClick={() => configure({ connect: !running })}
            disabled={!running && !botToken}
          >
            {running ? "Disconnect" : "Connect"}
          </Button>
          {running && (
            <span className="text-xs text-green-500 tracking-widest uppercase">
              Live
            </span>
          )}
        </div>

        {error && <div className="text-xs text-red-500 break-all">{error}</div>}
      </div>
    </RuntimeRestServiceUI>
  );
}
