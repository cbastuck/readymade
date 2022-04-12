import { useState, useRef } from "react";
import { Dropdown, Input, Button } from "semantic-ui-react";

function RemoteRuntimeInput({ onCancel, onChange }) {
  const remoteInput = useRef();
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <Input ref={remoteInput} />
      <Button
        icon="check"
        onClick={() => onChange(remoteInput.current.value)}
      />
      <Button icon="cancel" onCancel={onChange} />
    </div>
  );
}

export default function RuntimeMenu({ availableRuntimes, boardContext }) {
  const [showRuntimeMenuHighlighted, setShowRuntimeMenuHighlighted] =
    useState(false);
  const [inputRemoteRuntime, setInputRemoteRuntime] = useState(false);
  const dropdown = useRef();
  const wideViewMode = boardContext.appViewMode === "wide";
  const options = availableRuntimes.map((o) => ({
    key: o.name,
    value: o.args,
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
            boardContext.addRuntime(...["remote", host]);
            setInputRemoteRuntime(false);
          }}
          onCancel={() => setInputRemoteRuntime(false)}
        />
      ) : (
        <Dropdown
          compact={!wideViewMode}
          style={{ border: showRuntimeMenuHighlighted && "solid 2px #4284C4" }}
          ref={dropdown}
          options={options}
          placeholder={wideViewMode ? "Add Runtime" : "Runtime"}
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value === "remote") {
              setInputRemoteRuntime(true);
            } else if (value) {
              boardContext.addRuntime(...value.split(","));
              dropdown.current.clearValue();
              setShowRuntimeMenuHighlighted(false);
            }
          }}
        />
      )}
    </div>
  );
}
