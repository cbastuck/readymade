import { forwardRef, useContext, useImperativeHandle, useRef, useState } from "react";

import SelectorField from "./SelectorField";
import { Action } from "../../types";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import { ThemeCtx } from "hkp-frontend/src/ui-components/ThemeContext";

const none = "No Input";
const all = "All Peers";

type Props = {
  items: Array<string>;
  value: string | null;
  disabled: boolean;
  children: JSX.Element | Array<JSX.Element | null>;

  onSelect: (selected: string | null) => void;
  onAction: (action: Action) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
};

export type InputOptionsHandle = {
  signalIncoming: (sender: string) => void;
};

const InputOptions = forwardRef<InputOptionsHandle, Props>(function InputOptions(props, ref) {
  const context = useContext(ThemeCtx);
  const [expanded, setExpanded] = useState(false);
  const [incoming, setIncoming] = useState<boolean | string | undefined>(false);

  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIncoming = () => {
    setIncoming(undefined);
  };

  const signalIncoming = (sender: string) => {
    if (!incoming) {
      setIncoming(sender);
      incomingTimerRef.current = setTimeout(resetIncoming, 1000);
    }
  };

  useImperativeHandle(ref, () => ({
    signalIncoming,
  }));

  const allInputsWildcard = "*";
  const updatePeersAction = "update-peers" as const;

  const getSelectorOptions = () => {
    const { items } = props;
    return items.reduce((a, c) => ({ ...a, [c]: c }), {
      none,
      [allInputsWildcard]: all,
    });
  };

  const { value, onSelect, onAction, children, disabled, onExpand, onCollapse } = props;
  const peerOptions = getSelectorOptions();

  const renderExpanded = () => {
    return (
      <div
        style={{
          opacity: expanded ? 1 : 0,
          width: expanded ? 320 : 0,
          transition: "width 0.5s, opacity 0.5s",
          overflowX: "hidden",
          overflowY: "auto",
          minHeight: 350,
        }}
      >
        {!disabled ? (
          <div className="pt-4 px-4 flex flex-col gap-2">
            <GroupLabel>Allow From</GroupLabel>
            <SelectorField
              label="Peer"
              options={peerOptions}
              value={value === null ? "none" : value}
              disabled={disabled}
              onChange={({ value: newSelected }) => {
                onSelect(newSelected === "none" ? null : newSelected);
              }}
              onOpen={() => onAction({ type: updatePeersAction })}
            />
            <div>{children}</div>
          </div>
        ) : (
          <div className="pt-4 pl-4">
            <GroupLabel>Peers</GroupLabel>
            <div
              style={{
                paddingTop: 10,
                paddingLeft: 5,
                minHeight: "250px",
              }}
            >
              {children ? children : false}
            </div>
          </div>
        )}
      </div>
    );
  };

  const bgColor = incoming
    ? "bg-sky-400" // signal color
    : expanded
    ? "bg-sky-600"
    : context.runtimeBackgroundColor;
  const textColor = expanded ? "text-white" : "text-[#333]";

  return (
    <div
      className="h-full py-[10px] pr-8 mb-5"
      style={{
        position: "relative",
        height: "350px",
      }}
    >
      <div
        className="flex h-full bg-white rounded-lg shadow-sm"
        style={{
          border: `solid 1px #ccc`,
          borderLeft: "none",
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          position: "absolute",
          zIndex: 1,
        }}
      >
        {renderExpanded()}
        <button
          className={`text-base min-h-[100%] ml-auto w-[22px] ${bgColor} ${textColor} hover:bg-sky-600 hover:text-white`}
          onClick={() => {
            const wasExpanded = expanded;
            setExpanded(!wasExpanded);
            if (wasExpanded) {
              onCollapse?.();
            } else {
              onExpand?.();
            }
          }}
        >
          <div
            className="tracking-[4px] text-sm font-sans mt-[-25px]"
            style={{
              transform: "rotate(90deg)",
            }}
          >
            INPUT
          </div>
        </button>
      </div>
    </div>
  );
});

const InputOptionsWithStatics = Object.assign(InputOptions, {
  updatePeersAction: "update-peers" as const,
  allInputsWildcard: "*",
});

export default InputOptionsWithStatics;
