import { useState, useRef } from "react";
import { Dropdown, Icon } from "semantic-ui-react";
import RuntimeItem from "./RuntimeItem";
import { RuntimeClass } from "../../../types";
import RemoteRuntimeInput from "./RemoteRuntimeInput";

type Props = {
  availableRuntimes: Array<RuntimeClass>;
  onAddAvailableRuntime: (desc: RuntimeClass) => void;
  onRemoveAvailableRuntime: (desc: RuntimeClass) => void;
  onAddRuntime: (rtClass: RuntimeClass) => void;
  isWideViewMode: boolean;
};

export default function RuntimeMenu({
  availableRuntimes,
  onAddAvailableRuntime,
  onRemoveAvailableRuntime,
  onAddRuntime,
  isWideViewMode,
}: Props) {
  const [showRuntimeMenuHighlighted, setShowRuntimeMenuHighlighted] =
    useState(false);
  const [inputRemoteRuntime, setInputRemoteRuntime] = useState(false);
  const dropdown = useRef<any>(null);

  const options = availableRuntimes.map((rt, idx) => ({
    key: `${rt.name}.${idx}`,
    value: `${idx}`,
    children: (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
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

  const dropdownOptions = options.concat([
    {
      key: "add-remote-runtime-item",
      value: "add-runtime",
      children: (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <Icon name="plus" />
          New remote
        </div>
      ),
      selected: false,
    },
  ]);

  return (
    <div
      id="runtime-dropdown"
      className="hkp-fnt-family"
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
          style={{
            border: showRuntimeMenuHighlighted && "solid 2px #4284C4",
            whiteSpace: "nowrap",
            minWidth: !isWideViewMode ? 120 : undefined,
          }}
          ref={dropdown}
          options={dropdownOptions}
          placeholder={"Add Runtime"}
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value === "add-runtime") {
              setInputRemoteRuntime(true);
            } else if (value) {
              const idx = Number(value);
              if (isNaN(idx)) {
                throw new Error(
                  "RuntimeMenu.Dropdown.onChange selected value type mismatch"
                );
              }
              const selectedRuntime = availableRuntimes[idx];
              if (selectedRuntime) {
                onAddRuntime(selectedRuntime);
              }
              dropdown.current?.clearValue();
              setShowRuntimeMenuHighlighted(false);
            }
          }}
        />
      )}
    </div>
  );
}
