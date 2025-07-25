import { Component, CSSProperties } from "react";

import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";

import SyncIndicator from "./SyncIndicator";

type OnChangeEvent =
  | React.MouseEvent
  | React.KeyboardEvent
  | React.ChangeEvent<HTMLTextAreaElement>;
type OnChangeValue = { value: string };

type Props = {
  value: string;
  label: string;
  synced?: boolean;
  disabled?: boolean;
  unit?: string;
  labelStyle?: CSSProperties;
  style?: CSSProperties;
  resizeable?: boolean;

  onChange: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onEscape?: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onFocus?: () => void;
  onLabelClicked?: (ev: OnChangeEvent, value: OnChangeValue) => void;
};

type State = { value: string };

export default class InputText extends Component<Props, State> {
  state = {
    value: "",
  };

  componentDidMount() {
    const { value, synced = true } = this.props;
    if (synced) {
      this.setState({
        value,
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { value, synced = true } = this.props;
    if (synced) {
      if (value !== prevProps.value) {
        this.setState({ value });
      }
    }
  }

  render() {
    const {
      label,
      labelStyle,
      style,
      value: syncedValue,
      resizeable = true,
      synced = true,
      onChange,
      onLabelClicked = () => {},
    } = this.props;
    const value = synced ? this.state.value : syncedValue;
    const inSync = synced ? value === syncedValue : true;
    const fontSize = 11;
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          margin: "3px 0px",
          ...style,
          minWidth: "350px",
        }}
      >
        <div style={{ width: "100%", textAlign: "left" }}>
          <SyncIndicator
            onClick={(ev) =>
              inSync ? onLabelClicked(ev, { value }) : onChange(ev, { value })
            }
            inSync={synced ? inSync : true}
            label={label}
            style={{
              ...labelStyle,
              letterSpacing: 1,
              fontSize,
              width: "100%",
              textAlign: "left",
            }}
          />
        </div>
        <Textarea
          style={{
            width: "100%",
            fontSize: 14,
            resize: resizeable ? "both" : "none",
            border: "none",
            borderBottom: "1px solid lightgray",
          }}
          value={value === undefined ? "" : value}
          onChange={(ev) => this.setState({ value: ev.target.value })}
          onKeyUp={(ev: React.KeyboardEvent) => {
            switch (ev.key) {
              case "Enter":
                if (ev.ctrlKey && value !== "") {
                  return onChange(ev, { value });
                }
                break;
              default:
                break;
            }
          }}
        />
      </div>
    );
  }
}
