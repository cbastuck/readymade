import { useState, useRef } from "react";
import { Dropdown, Input, Button, Icon } from "semantic-ui-react";

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

function RuntimeItem({ name, type, url, onRemove }) {
  return type === "remote" ? (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div>{name}</div>
      <div style={{ padding: 0, marginLeft: "auto", width: 15 }}>
        <Button
          fluid
          style={{ padding: 0, margin: 0 }}
          icon="remove"
          onClick={(ev) => {
            onRemove();
            ev.stopPropagation();
          }}
        />
      </div>
    </div>
  ) : (
    <div> Add {name} </div>
  );
}

export default function RuntimeMenu({
  availableRuntimes,
  onAddAvailableRuntime,
  onRemoveAvailableRuntime,
  onAddRuntime,
  isWideViewMode,
}) {
  const [showRuntimeMenuHighlighted, setShowRuntimeMenuHighlighted] =
    useState(false);
  const [inputRemoteRuntime, setInputRemoteRuntime] = useState(false);
  const dropdown = useRef();
  const options = availableRuntimes.map((rt, idx) => ({
    key: `${rt.name}.${idx}`,
    value: `${idx}`,
    children: (
      <div style={{ display: "flex", flexDirection: "row" }}>
        <Icon name="plus" />
        <RuntimeItem
          {...rt}
          onRemove={() => {
            onRemoveAvailableRuntime(rt);
          }}
        />
      </div>
    ),
    selected: false,
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
          onChange={(desc) => {
            onAddAvailableRuntime(desc);
            setInputRemoteRuntime(false);
          }}
          onCancel={() => setInputRemoteRuntime(false)}
        />
      ) : (
        <Dropdown
          compact={!isWideViewMode}
          style={{ border: showRuntimeMenuHighlighted && "solid 2px #4284C4" }}
          ref={dropdown}
          options={options.concat({
            key: "add-remote-runtime-item",
            value: "add-runtime",
            children: (
              <div>
                <Icon name="plus" />
                Add remote
              </div>
            ),
          })}
          placeholder={isWideViewMode ? "Add Runtime" : "Runtime"}
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value === "add-runtime") {
              setInputRemoteRuntime(true);
            } else if (value) {
              const selectedRuntime = availableRuntimes[value];
              if (selectedRuntime) {
                onAddRuntime(selectedRuntime);
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
