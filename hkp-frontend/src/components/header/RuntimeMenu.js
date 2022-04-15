import { useState, useRef } from "react";
import { Dropdown, Input, Button } from "semantic-ui-react";

import { s, t } from "../../styles";

function RemoteRuntimeInput({ onCancel, onChange }) {
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
        onClick={() => onChange({ name, url: host })}
        fluid
      />
      <Button icon="cancel" onClick={onCancel} fluid />
    </div>
  );
}

export default function RuntimeMenu({ boardContext }) {
  const [showRuntimeMenuHighlighted, setShowRuntimeMenuHighlighted] =
    useState(false);
  const [inputRemoteRuntime, setInputRemoteRuntime] = useState(false);
  const dropdown = useRef();
  const wideViewMode = boardContext.appViewMode === "wide";
  const options = boardContext.availableRuntimes.map((o, idx) => ({
    key: `${o.name}.${idx}`,
    value: `${idx}`,
    text: o.name,
  }));
  return (
    <div
      id="runtime-dropdown"
      style={{
        marginLeft: 10,
        marginTop: 3,
      }}
      onClick={(ev) => {
        if (dropdown.current) {
          setShowRuntimeMenuHighlighted(true);
          dropdown.current.open(ev);
        }
      }}
    >
      {inputRemoteRuntime ? (
        <RemoteRuntimeInput
          onChange={(host) => {
            boardContext.addAvailableRuntime(host);
            setInputRemoteRuntime(false);
          }}
          onCancel={() => setInputRemoteRuntime(false)}
        />
      ) : (
        <Dropdown
          compact={!wideViewMode}
          style={{ border: showRuntimeMenuHighlighted && "solid 2px #4284C4" }}
          ref={dropdown}
          options={options.concat({
            key: "add-remote-runtime-item",
            value: "add-runtime",
            text: "<add remote>",
          })}
          placeholder={wideViewMode ? "Add Runtime" : "Runtime"}
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value === "add-runtime") {
              setInputRemoteRuntime(true);
            } else if (value) {
              const selectedRuntime = boardContext.availableRuntimes[value];
              if (selectedRuntime) {
                const { name, args, url } = selectedRuntime;
                boardContext.addRuntime(args, name, url);
              }
              dropdown.current.clearValue();
              setShowRuntimeMenuHighlighted(false);
            }
          }}
        />
      )}
    </div>
  );
}
