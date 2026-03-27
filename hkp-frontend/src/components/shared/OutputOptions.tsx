import { Component, ReactElement } from "react";

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

type State = {
  expanded: boolean;
};

export default class OutputOptions extends Component<Props, State> {
  static contextType = ThemeCtx;
  declare context: React.ContextType<typeof ThemeCtx>;
  state = { expanded: false };

  componentDidUpdate(_prevPops: Props, prevState: State) {
    if (prevState.expanded !== this.state.expanded) {
      this.props.onAction({ type: "update-peers" });
    }
  }

  getSelectorOptions = () => {
    const { items } = this.props;
    return items.reduce((a, c) => ({ ...a, [c]: c }), {
      [none]: none,
    });
  };

  renderOptions = (label: string, selector: ReactElement) => {
    return (
      <div className="pt-4 pl-4">
        <GroupLabel>{label}</GroupLabel>
        {selector}
      </div>
    );
  };

  renderPeerOptions = () => {
    const { onSelect, onAction, value = "pass" } = this.props;
    const peerOptions = this.getSelectorOptions();
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {this.renderOptions(
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
        <div style={{ paddingBottom: 20 }}>{this.props.children}</div>
      </div>
    );
  };

  renderFlowOptions = () => {
    const { onAction, flow = "pass" } = this.props;
    return this.renderOptions(
      "Flow",
      <SelectorField
        options={{
          pass: "pass",
          stop: "stop",
          // stopIf: 'stop-if'
        }}
        value={flow}
        onChange={({ value: flow }) => {
          if (isValidFlowOption(flow)) {
            onAction({ type: "flow-changed", flow });
          }
        }}
      />
    );
  };

  renderSidechainOptions = () => {
    const {
      boardContext,
      sidechainRouting = [],
      onSidechangeRouting,
    } = this.props;
    return this.renderOptions(
      "Sidechain",
      <div style={{ display: this.state.expanded ? undefined : "none" }}>
        <SidechainSelector
          boardContext={boardContext}
          values={sidechainRouting}
          onChange={(routing) => onSidechangeRouting(routing)}
        />
      </div>
    );
  };

  renderExpanded = () => {
    const { disabled } = this.props;
    const { expanded } = this.state;
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
        {this.renderFlowOptions()}
        {this.renderSidechainOptions()}

        {disabled ? (
          <div className="pt-4 pl-4 flex flex-col gap-2">
            <GroupLabel>Peers</GroupLabel>
            <div className="p-0 text-base">{this.props.children}</div>
          </div>
        ) : (
          this.renderPeerOptions()
        )}
      </div>
    );
  };

  render() {
    const { expanded } = this.state;
    const { id, onExpand, onCollapse } = this.props;

    const bgColor = expanded
      ? "bg-sky-600"
      : this.context.runtimeBackgroundColor;
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
              this.setState({ expanded: !expanded }, () => {
                if (expanded) {
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
              });
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
          {this.renderExpanded()}
        </div>
      </div>
    );
  }
}
