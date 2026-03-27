import { Component } from "react";

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

type State = {
  selected: string;
  expanded: boolean;
  incoming: boolean | string | undefined;
};

export default class InputOptions extends Component<Props, State> {
  static contextType = ThemeCtx;
  declare context: React.ContextType<typeof ThemeCtx>;
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
    const { expanded } = this.state;
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
              value={value === null ? "none" : value}
              disabled={disabled}
              onChange={({ value: selected }) =>
                this.setState({ selected }, () =>
                  onSelect(selected === "none" ? null : selected)
                )
              }
              onOpen={() => onAction({ type: InputOptions.updatePeersAction })}
            />
            <div>{this.props.children}</div>
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

    const bgColor = incoming
      ? "bg-sky-400" // signal color
      : expanded
      ? "bg-sky-600"
      : this.context.runtimeBackgroundColor;
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
          {this.renderExpanded()}
          <button
            className={`text-base min-h-[100%] ml-auto w-[22px] ${bgColor} ${textColor} hover:bg-sky-600 hover:text-white`}
            onClick={() => {
              this.setState({ expanded: !expanded }, () => {
                if (expanded) {
                  onCollapse?.();
                } else {
                  onExpand?.();
                }
              });
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
  }
}
