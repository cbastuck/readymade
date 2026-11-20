import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

const MSGTYPES = {
  "m.text": "Text",
  "m.notice": "Notice",
  "m.emote": "Emote",
};

export default function MatrixSenderUI(props: ServiceUIProps) {
  const [homeserver, setHomeserver] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [roomId, setRoomId] = useState("");
  const [msgtype, setMsgtype] = useState("m.text");
  const [lastEventId, setLastEventId] = useState("");
  const [error, setError] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.homeserver !== undefined) {
      setHomeserver(state.homeserver);
    }
    if (state.accessToken !== undefined) {
      setAccessToken(state.accessToken);
    }
    if (state.roomId !== undefined) {
      setRoomId(state.roomId);
    }
    if (state.msgtype !== undefined) {
      setMsgtype(state.msgtype);
    }
    if (state.lastEventId !== undefined) {
      setLastEventId(state.lastEventId);
    }
    if (state.error !== undefined) {
      setError(state.error);
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
            token. The value lives in the vault and is resolved per send. */}
        <InputField
          label="Access token secret"
          value={accessToken}
          onChange={(v) => {
            setAccessToken(v);
            configure({ accessToken: v });
          }}
        />

        <InputField
          label="Room"
          value={roomId}
          onChange={(v) => {
            setRoomId(v);
            configure({ roomId: v });
          }}
        />

        <SelectorField
          label="Type"
          value={msgtype}
          options={MSGTYPES}
          onChange={({ value }) => {
            setMsgtype(value);
            configure({ msgtype: value });
          }}
        />

        {lastEventId && !error && (
          <div className="text-xs text-muted-foreground break-all">
            Sent {lastEventId}
          </div>
        )}
        {error && <div className="text-xs text-red-500 break-all">{error}</div>}
      </div>
    </RuntimeRestServiceUI>
  );
}
