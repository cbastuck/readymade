import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Switch from "hkp-frontend/src/ui-components/Switch";

export default function SmtpEmailUI(props: ServiceUIProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tls, setTls] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");

  const onUpdate = useCallback((state: any) => {
    if (state.host !== undefined) setHost(state.host);
    if (state.port !== undefined) setPort(String(state.port));
    if (state.username !== undefined) setUsername(state.username);
    if (state.password !== undefined) setPassword(state.password);
    if (state.tls !== undefined) setTls(state.tls);
    if (state.from !== undefined) setFrom(state.from);
    if (state.to !== undefined) setTo(state.to);
    if (state.subject !== undefined) setSubject(state.subject);
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

        <Switch
          title="TLS"
          checked={tls}
          onCheckedChange={(checked) => {
            setTls(checked);
            configure({ tls: checked });
          }}
        />

        <InputField
          label="From"
          value={from}
          onChange={(v) => {
            setFrom(v);
            configure({ from: v });
          }}
        />

        <InputField
          label="To"
          value={to}
          onChange={(v) => {
            setTo(v);
            configure({ to: v });
          }}
        />

        <InputField
          label="Subject"
          value={subject}
          onChange={(v) => {
            setSubject(v);
            configure({ subject: v });
          }}
        />

        {error && <div className="text-xs text-red-500 break-all">{error}</div>}
      </div>
    </RuntimeRestServiceUI>
  );
}
