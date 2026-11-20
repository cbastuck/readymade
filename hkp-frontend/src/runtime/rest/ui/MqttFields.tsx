import { useCallback, useState } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

import Button from "hkp-frontend/src/ui-components/Button";
import Switch from "hkp-frontend/src/ui-components/Switch";

const MODES = { subscribe: "subscribe", publish: "publish" };
const QOS = { "0": "0", "1": "1", "2": "2" };
const FORMATS = { auto: "auto", text: "text", binary: "binary" };

const selectorLabel = { textTransform: "capitalize", textAlign: "left" };

/**
 * The MQTT client's panel, without the frame around it.
 *
 * The service is the same on hkp-node and in the browser — one state
 * contract — and only the frame differs, so each runtime's panel wraps these
 * fields in its own and feeds `onUpdate` what the service reports.
 */
export function useMqttFields(
  configure: (patch: Record<string, unknown>) => void,
) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("subscribe");
  const [topics, setTopics] = useState("");
  const [topic, setTopic] = useState("");
  const [qos, setQos] = useState("0");
  const [retain, setRetain] = useState(false);
  const [format, setFormat] = useState("auto");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState("");
  // What was asked for, and what the connection is actually doing — they
  // differ while a dropped connection is being re-established.
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [received, setReceived] = useState(0);
  const [published, setPublished] = useState(0);

  const onUpdate = useCallback((state: any) => {
    if (state.url !== undefined) {
      setUrl(state.url);
    }
    if (state.mode !== undefined) {
      setMode(state.mode);
    }
    if (Array.isArray(state.topics)) {
      setTopics(state.topics.join(", "));
    }
    if (state.topic !== undefined) {
      setTopic(state.topic);
    }
    if (state.qos !== undefined) {
      setQos(String(state.qos));
    }
    if (state.retain !== undefined) {
      setRetain(state.retain);
    }
    if (state.format !== undefined) {
      setFormat(state.format);
    }
    if (state.username !== undefined) {
      setUsername(state.username);
    }
    if (state.password !== undefined) {
      setPassword(state.password);
    }
    if (state.clientId !== undefined) {
      setClientId(state.clientId);
    }
    if (state.enabled !== undefined) {
      setEnabled(state.enabled);
    }
    if (state.running !== undefined) {
      setRunning(state.running);
    }
    if (state.status !== undefined) {
      setStatus(state.status);
    }
    if (state.reconnectAttempts !== undefined) {
      setAttempts(state.reconnectAttempts);
    }
    if (state.error !== undefined) {
      setError(state.error);
    }
    if (state.received !== undefined) {
      setReceived(state.received);
    }
    if (state.published !== undefined) {
      setPublished(state.published);
    }
  }, []);

  const subscribing = mode === "subscribe";
  const count = subscribing ? received : published;

  const fields = (
    <div className="flex flex-col gap-1" style={{ minWidth: 280 }}>
      <InputField
        label="Broker"
        value={url}
        onChange={(v) => {
          setUrl(v);
          configure({ url: v });
        }}
      />

      <SelectorField
        label="Mode"
        value={mode}
        options={MODES}
        uppercaseKeys={false}
        uppercaseValues={false}
        labelStyle={selectorLabel}
        onChange={({ value }) => {
          setMode(value);
          configure({ mode: value });
        }}
      />

      {subscribing ? (
        <InputField
          label="Topics"
          value={topics}
          onChange={(v) => {
            setTopics(v);
            configure({ topics: v });
          }}
        />
      ) : (
        <InputField
          label="Topic"
          value={topic}
          onChange={(v) => {
            setTopic(v);
            configure({ topic: v });
          }}
        />
      )}

      <SelectorField
        label="QoS"
        value={qos}
        options={QOS}
        labelStyle={selectorLabel}
        onChange={({ value }) => {
          setQos(value);
          configure({ qos: Number(value) });
        }}
      />

      {subscribing ? (
        <SelectorField
          label="Payload"
          value={format}
          options={FORMATS}
          uppercaseKeys={false}
          uppercaseValues={false}
          labelStyle={selectorLabel}
          onChange={({ value }) => {
            setFormat(value);
            configure({ format: value });
          }}
        />
      ) : (
        <Switch
          title="Retain"
          checked={retain}
          onCheckedChange={(checked) => {
            setRetain(checked);
            configure({ retain: checked });
          }}
        />
      )}

      <InputField
        label="Username"
        value={username}
        onChange={(v) => {
          setUsername(v);
          configure({ username: v });
        }}
      />

      {/* Not masked: this field holds the *name* of a secret, not a secret.
            The value lives in the vault and is fetched when the connection is
            opened, so hiding what is typed here would hide nothing and make a
            mistyped alias impossible to spot. */}
      <InputField
        label="Password secret"
        value={password}
        onChange={(v) => {
          setPassword(v);
          configure({ password: v });
        }}
      />

      <InputField
        label="Client ID"
        value={clientId}
        onChange={(v) => {
          setClientId(v);
          configure({ clientId: v });
        }}
      />

      <div className="flex items-center gap-2 pt-1">
        <Button
          className="hkp-svc-btn"
          onClick={() => configure({ connect: !enabled })}
          disabled={!enabled && !url}
        >
          {enabled ? "Disconnect" : "Connect"}
        </Button>
        {running && (
          <span className="text-xs text-green-500 tracking-widest uppercase">
            Live
          </span>
        )}
        {enabled && !running && (
          <span className="text-xs text-amber-500 tracking-widest uppercase">
            {status === "reconnecting"
              ? `Reconnecting${attempts > 1 ? ` (${attempts})` : ""}`
              : "Connecting"}
          </span>
        )}
        {count > 0 && (
          <span className="text-xs opacity-60">
            {count} {subscribing ? "received" : "published"}
          </span>
        )}
      </div>

      {error && <div className="text-xs text-red-500 break-all">{error}</div>}
    </div>
  );

  return { onUpdate, fields };
}
