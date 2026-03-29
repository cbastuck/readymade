import { ReactElement, useContext, useEffect, useRef, useState } from "react";

import SelectorField from "./SelectorField";
import SidechainSelector from "./SidechainSelector";
import {
  Action,
  RuntimeFlowOutputOptions,
  SidechainRoute,
  isValidFlowOption,
} from "../../types";
import { BoardContextState } from "../../BoardContext";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import { ThemeCtx } from "hkp-frontend/src/ui-components/ThemeContext";

const none = "No Output";

type Props = {
  items: Array<string>;
  value: string | null;
  children: JSX.Element | Array<JSX.Element | null>;
  flow: RuntimeFlowOutputOptions | undefined;
  boardContext: BoardContextState;
  sidechainRouting: Array<SidechainRoute>;
  id: string;
  disabled?: boolean;

  onSidechangeRouting: (route: Array<SidechainRoute>) => void;
  onAction: (action: Action) => void;
  onSelect: (item: string | null) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
};

export default function OutputOptions(props: Props) {
  const context = useContext(ThemeCtx);
  const [expanded, setExpanded] = useState(false);

  const prevExpandedRef = useRef(expanded);

  // componentDidUpdate: fire onAction when expanded changes
  useEffect(() => {
    if (prevExpandedRef.current !== expanded) {
      props.onAction({ type: "update-peers" });
    }
    prevExpandedRef.current = expanded;
  });

  const getSelectorOptions = () => {
    const { items } = props;
    return items.reduce((a, c) => ({ ...a, [c]: c }), {
      [none]: none,
    });
  };

  const renderOptions = (label: string, selector: ReactElement) => {
    return (
      <div className="pt-4 pl-4">
        <GroupLabel>{label}</GroupLabel>
        {selector}
      </div>
    );
  };

  const renderPeerOptions = () => {
    const { onSelect, onAction, value = "pass" } = props;
    const peerOptions = getSelectorOptions();
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {renderOptions(
          "Peers",
          <SelectorField
            label="Target"
            options={peerOptions}
            value={value || none}
            onChange={({ value: selected }) => {
              onSelect(selected === none ? null : selected);
            }}
            onOpen={() => onAction({ type: "update-peers" })}
          />
        )}
        <div style={{ paddingBottom: 20 }}>{props.children}</div>
      </div>
    );
  };

  const renderFlowOptions = () => {
    const { onAction, flow = "pass" } = props;
    return renderOptions(
      "Flow",
      <SelectorField
        options={{
          pass: "pass",
          stop: "stop",
          // stopIf: 'stop-if'
        }}
        value={flow}
        onChange={({ value: flowVal }) => {
          if (isValidFlowOption(flowVal)) {
            onAction({ type: "flow-changed", flow: flowVal });
          }
        }}
      />
    );
  };

  const renderSidechainOptions = () => {
    const {
      boardContext,
      sidechainRouting = [],
      onSidechangeRouting,
    } = props;
    return renderOptions(
      "Sidechain",
      <div style={{ display: expanded ? undefined : "none" }}>
        <SidechainSelector
          boardContext={boardContext}
          values={sidechainRouting}
          onChange={(routing) => onSidechangeRouting(routing)}
        />
      </div>
    );
  };

  const renderExpanded = () => {
    const { disabled } = props;
    return (
      <div
        style={{
          opacity: expanded ? 1 : 0,
          width: expanded ? 320 : 0,
          transition: "width 0.5s, opacity 0.5s",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        {renderFlowOptions()}
        {renderSidechainOptions()}

        {disabled ? (
          <div className="pt-4 pl-4 flex flex-col gap-2">
            <GroupLabel>Peers</GroupLabel>
            <div className="p-0 text-base">{props.children}</div>
          </div>
        ) : (
          renderPeerOptions()
        )}
      </div>
    );
  };

  const { id, onExpand, onCollapse } = props;

  const bgColor = expanded
    ? "bg-sky-600"
    : context.runtimeBackgroundColor;
  const textColor = expanded ? "text-white" : "text-[#333]";

  return (
    <div
      className="h-full py-[10px] mb-5"
      style={{ position: "relative", height: "350px" }}
    >
      <div
        className="flex h-full bg-white rounded-lg shadow-sm"
        id={`output-options-${id}`}
        style={{
          border: `solid 1px #ccc`,
          borderRight: "none",
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          position: "absolute",
          right: 0,
          zIndex: 1,
        }}
      >
        <button
          className={`text-base min-h-[100%] ml-auto w-[22px] ${bgColor} ${textColor} hover:bg-sky-600 hover:text-white`}
          onClick={() => {
            const wasExpanded = expanded;
            setExpanded(!wasExpanded);
            if (wasExpanded) {
              onCollapse?.();
            } else {
              onExpand?.();
              const elem = document.getElementById(`output-options-${id}`);
              if (elem) {
                setTimeout(
                  () =>
                    elem.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    }),
                  400
                );
              }
            }
          }}
        >
          <div
            className="tracking-[4px] text-sm font-sans mt-[-25px]"
            style={{
              transform: "rotate(90deg)",
            }}
          >
            OUTPUT
          </div>
        </button>
        {renderExpanded()}
      </div>
    </div>
  );
}
