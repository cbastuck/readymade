import { Component } from "react";

import { s, t } from "../../styles";
import SelectorField from "./SelectorField";
import { Action } from "../../types";
import GroupLabel from "@/ui-components/GroupLabel";

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

type State = {
  selected: string;
  expanded: boolean;
  incoming: boolean | string | undefined;
};

export default class InputOptions extends Component<Props, State> {
  state = {
    selected: "none",
    expanded: false,
    incoming: false,
  };

  static updatePeersAction = "update-peers" as const;
  static allInputsWildcard = "*";

  getSelectorOptions = () => {
    const { items } = this.props;
    return items.reduce((a, c) => ({ ...a, [c]: c }), {
      none,
      [InputOptions.allInputsWildcard]: all,
    });
  };

  signalIncoming = (sender: string) => {
    if (!this.state.incoming) {
      this.setState({ incoming: sender }, () =>
        setTimeout(this.resetIncoming, 1000)
      );
    }
  };

  resetIncoming = () => {
    this.setState({ incoming: undefined });
  };

  renderExpanded = () => {
    const { incoming, expanded } = this.state;
    const { value, onSelect, onAction, children, disabled } = this.props;
    const peerOptions = this.getSelectorOptions();
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
              highlight={typeof incoming === "string" ? incoming : undefined}
              value={value === null ? "none" : value}
              disabled={disabled}
              onChange={(_ev, { value: selected }) =>
                this.setState({ selected }, () =>
                  onSelect(selected === "none" ? null : selected)
                )
              }
              onOpen={() => onAction({ type: InputOptions.updatePeersAction })}
            />
            <div style={{ paddingBottom: 20 }}>{this.props.children}</div>
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

  render() {
    const { expanded, incoming } = this.state;
    const { onExpand, onCollapse } = this.props;
    return (
      <div className="h-full py-[20px]" style={{ minHeight: "100%" }}>
        <div
          className="flex h-full"
          style={{
            border: "solid 1px lightgray",
            borderLeft: "none",
            borderRadius: 5,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }}
        >
          {this.renderExpanded()}
          <button
            className="text-base min-h-[100%] ml-auto w-[33px]"
            style={{
              backgroundColor: incoming
                ? "#8aa1b7" // signal color
                : expanded
                ? "gray"
                : "#efefef",
            }}
            onClick={() => {
              this.setState({ expanded: !expanded }, () => {
                if (expanded) {
                  onCollapse && onCollapse();
                } else {
                  onExpand && onExpand();
                }
              });
            }}
          >
            <div
              className="tracking-[4px] text-sm font-sans mt-[-25px]"
              style={{
                transform: "rotate(90deg)",
                color: expanded ? "white" : "#333",
              }}
            >
              INPUT
            </div>
          </button>
        </div>
      </div>
    );
  }
}
