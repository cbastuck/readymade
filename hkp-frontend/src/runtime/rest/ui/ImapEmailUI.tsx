import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";

import Button from "hkp-frontend/src/ui-components/Button";
import Switch from "hkp-frontend/src/ui-components/Switch";

export default function ImapEmailUI(props: ServiceUIProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tls, setTls] = useState(true);
  const [mailbox, setMailbox] = useState("INBOX");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.host !== undefined) setHost(state.host);
    if (state.port !== undefined) setPort(String(state.port));
    if (state.username !== undefined) setUsername(state.username);
    if (state.password !== undefined) setPassword(state.password);
    if (state.tls !== undefined) setTls(state.tls);
    if (state.mailbox !== undefined) setMailbox(state.mailbox);
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
      <div className="flex flex-col gap-1">
        <InputField
          label="Host"
          value={host}
          onChange={(v) => {
            setHost(v);
            configure({ host: v });
          }}
        />

        <InputField
          label="Port"
          value={port}
          onChange={(v) => {
            setPort(v);
            const n = parseInt(v, 10);
            if (!isNaN(n)) configure({ port: n });
          }}
        />

        <InputField
          label="Username"
          value={username}
          onChange={(v) => {
            setUsername(v);
            configure({ username: v });
          }}
        />

        <InputField
          label="Password"
          type="password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            configure({ password: v });
          }}
        />

        <div className="flex">
          <InputField
            label="Mailbox"
            value={mailbox}
            onChange={(v) => {
              setMailbox(v);
              configure({ mailbox: v });
            }}
          />
        </div>

        <Switch
          title="TLS"
          checked={tls}
          onCheckedChange={(checked) => {
            setTls(checked);
            configure({ tls: checked });
          }}
        />

        {/* Connect / status */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            className="hkp-svc-btn"
            onClick={() => configure({ connect: !running })}
            disabled={!running && (!host || !username || !password)}
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
