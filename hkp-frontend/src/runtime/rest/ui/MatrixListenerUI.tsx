import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import Switch from "hkp-frontend/src/ui-components/Switch";

function roomsFromText(text: string): string[] {
  return text
    .split(",")
    .map((room) => room.trim())
    .filter((room) => room.length > 0);
}

export default function MatrixListenerUI(props: ServiceUIProps) {
  const [homeserver, setHomeserver] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [rooms, setRooms] = useState("");
  const [includeOwn, setIncludeOwn] = useState(false);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.homeserver !== undefined) {
      setHomeserver(state.homeserver);
    }
    if (state.accessToken !== undefined) {
      setAccessToken(state.accessToken);
    }
    if (Array.isArray(state.rooms)) {
      setRooms(state.rooms.join(", "));
    }
    if (state.includeOwn !== undefined) {
      setIncludeOwn(!!state.includeOwn);
    }
    if (state.running !== undefined) {
      setRunning(!!state.running);
    }
    if (state.connected !== undefined) {
      setConnected(!!state.connected);
    }
    if (state.userId !== undefined) {
      setUserId(state.userId);
    }
    if (state.error !== undefined) {
      setError(state.error);
    }
    if (state.warning !== undefined) {
      setWarning(state.warning);
    }
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
          label="Homeserver"
          value={homeserver}
          onChange={(v) => {
            setHomeserver(v);
            configure({ homeserver: v });
          }}
        />

        {/* Not masked: this field holds a {{secret.…}} reference, not the
            token. The value lives in the vault and is resolved per request. */}
        <InputField
          label="Access token secret"
          value={accessToken}
          onChange={(v) => {
            setAccessToken(v);
            configure({ accessToken: v });
          }}
        />

        <InputField
          label="Rooms"
          value={rooms}
          onChange={(v) => {
            setRooms(v);
            configure({ rooms: roomsFromText(v) });
          }}
        />

        <Switch
          title="Include own messages"
          checked={includeOwn}
          onCheckedChange={(checked) => {
            setIncludeOwn(checked);
            configure({ includeOwn: checked });
          }}
        />

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="hkp-svc-btn"
            onClick={() => configure({ running: !running })}
            disabled={!running && (!homeserver || !accessToken)}
          >
            {running ? "Disconnect" : "Connect"}
          </Button>
          {connected && (
            <span className="text-xs text-green-500 tracking-widest uppercase">
              Live
            </span>
          )}
          {userId && (
            <span className="text-xs text-muted-foreground truncate">
              {userId}
            </span>
          )}
        </div>

        {error && <div className="text-xs text-red-500 break-all">{error}</div>}
        {warning && (
          <div className="text-xs text-amber-500 break-all">{warning}</div>
        )}
      </div>
    </RuntimeRestServiceUI>
  );
}
