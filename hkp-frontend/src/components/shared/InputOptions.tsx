import { Component } from "react";

import { s, t } from "../../styles";
import SelectorField from "./SelectorField";
import { Action } from "../../types";

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
          paddingTop: 10,
          opacity: expanded ? 1 : 0,
          width: expanded ? 300 : 0,
          transition: "width 0.5s, opacity 0.5s",
          overflow: "hidden",
        }}
      >
        {!disabled && (
          <>
            <h1 style={s(t.tc, t.fs11)}>Allow From</h1>
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
          </>
        )}
        <div
          style={{
            paddingTop: 10,
            paddingLeft: 5,
          }}
        >
          {children ? children : false}
        </div>
      </div>
    );
  };

  render() {
    const { expanded, incoming } = this.state;
    const { onExpand, onCollapse } = this.props;
    return (
      <div
        style={s(
          t.ls1,
          t.fs13,
          {
            height: 300,
            marginTop: 10,
          },
          {
            border: "solid 1px lightgray",
            borderLeft: "none",
            borderRadius: 5,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
          {
            display: "flex",
            flexDirection: "row",
          }
        )}
      >
        {this.renderExpanded()}
        <button
          style={{
            marginLeft: "auto",
            height: "100%",
            border: "none",
            textAlign: "center",
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
            className=""
            style={s(t.ls2, t.fs11, {
              transform: "rotate(-90deg)",
              marginTop: 35,
              width: 8,
              color: expanded ? "white" : "#333",
            })}
          >
            Input
          </div>
        </button>
      </div>
    );
  }
}
