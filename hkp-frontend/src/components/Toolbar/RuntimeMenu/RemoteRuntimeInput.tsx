import { useState } from "react";

import { Input, Button } from "semantic-ui-react";

import { s, t } from "../../../styles";
import { RuntimeClass } from "../../../types";

type Props = {
  onCancel: () => void;
  onChange: (rt: RuntimeClass) => void;
};

export default function RemoteRuntimeInput({ onCancel, onChange }: Props) {
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        marginLeft: 5,
      }}
    >
      <div style={s(t.mt(8), t.fs11, t.mr(5))}>Name </div>
      <Input value={name} onChange={(ev) => setName(ev.target.value)} />
      <div style={{ marginLeft: 10 }} />
      <div style={s(t.mt(8), t.fs11, t.mr(5))}>URL </div>
      <Input value={host} onChange={(ev) => setHost(ev.target.value)} />
      <div style={{ marginLeft: 5 }} />
      <Button
        icon="check"
        onClick={() => onChange({ type: "remote", name, url: host })}
        fluid
      />
      <Button icon="cancel" onClick={onCancel} fluid />
    </div>
  );
}
