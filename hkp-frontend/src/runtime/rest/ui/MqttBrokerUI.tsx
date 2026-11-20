import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";

import CopyButton from "hkp-frontend/src/ui-components/CopyButton";
import Switch from "hkp-frontend/src/ui-components/Switch";

type Client = { id: string; address: string };

/** A mount's address as an MQTT client is given it. */
function asWebSocket(address: string): string {
  return address.replace(/^http/, "ws");
}

export default function MqttBrokerUI(props: ServiceUIProps) {
  const [bypass, setBypass] = useState(true);
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [topics, setTopics] = useState("#");
  const [topic, setTopic] = useState("");
  const [port, setPort] = useState("");
  const [listening, setListening] = useState(0);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [received, setReceived] = useState(0);
  const [published, setPublished] = useState(0);

  const onUpdate = useCallback((state: any) => {
    if (state.bypass !== undefined) {
      setBypass(state.bypass);
    }
    if (state.__hkpMount !== undefined) {
      setAddress(state.__hkpMount);
    }
    if (state.username !== undefined) {
      setUsername(state.username);
    }
    if (state.password !== undefined) {
      setPassword(state.password);
    }
    if (Array.isArray(state.topics)) {
      setTopics(state.topics.join(", "));
    }
    if (state.topic !== undefined) {
      setTopic(state.topic);
    }
    if (state.port !== undefined) {
      setPort(state.port ? String(state.port) : "");
    }
    if (state.listening !== undefined) {
      setListening(state.listening);
    }
    if (state.error !== undefined) {
      setError(state.error);
    }
    if (Array.isArray(state.clients)) {
      setClients(state.clients);
    }
    if (state.received !== undefined) {
      setReceived(state.received);
    }
    if (state.published !== undefined) {
      setPublished(state.published);
    }
  }, []);

  const configure = (patch: Record<string, unknown>) => {
    props.service.configure(patch);
  };

  const on = !bypass;

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-1" style={{ minWidth: 280 }}>
        <Switch
          title="On"
          checked={on}
          onCheckedChange={(checked) => {
            setBypass(!checked);
            configure({ bypass: !checked });
          }}
        />

        {on && address && (
          <div className="flex items-center gap-1 text-xs">
            <span className="break-all opacity-80">{asWebSocket(address)}</span>
            <CopyButton value={asWebSocket(address)} />
          </div>
        )}

        <InputField
          label="Hand on"
          value={topics}
          onChange={(v) => {
            setTopics(v);
            configure({ topics: v });
          }}
        />

        <InputField
          label="Publish as"
          value={topic}
          onChange={(v) => {
            setTopic(v);
            configure({ topic: v });
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

        {/* Not masked: this field holds the *name* of a secret, not a secret. */}
        <InputField
          label="Password secret"
          value={password}
          onChange={(v) => {
            setPassword(v);
            configure({ password: v });
          }}
        />

        <InputField
          label="TCP port"
          value={port}
          onChange={(v) => {
            setPort(v);
            const n = v.trim() === "" ? 0 : parseInt(v, 10);
            if (!isNaN(n)) {
              configure({ port: n });
            }
          }}
        />

        {on && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-green-500 tracking-widest uppercase">
              {clients.length} {clients.length === 1 ? "client" : "clients"}
            </span>
            {listening > 0 && (
              <span className="opacity-60">TCP on {listening}</span>
            )}
            {received + published > 0 && (
              <span className="opacity-60">
                {received} in · {published} out
              </span>
            )}
          </div>
        )}

        {on && clients.length > 0 && (
          <div className="flex flex-col text-xs opacity-80">
            {clients.map((client) => (
              <span key={client.id} className="break-all">
                {client.id}
                {client.address ? ` — ${client.address}` : ""}
              </span>
            ))}
          </div>
        )}

        {error && <div className="text-xs text-red-500 break-all">{error}</div>}
      </div>
    </RuntimeRestServiceUI>
  );
}
