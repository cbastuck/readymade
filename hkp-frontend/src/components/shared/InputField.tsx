import { Component } from "react";

import { Input, Checkbox } from "semantic-ui-react";

import SyncIndicator from "./SyncIndicator";
import { s, t } from "../../styles";

type InputValueType = string | number | boolean | undefined;
type OnChangeEvent =
  | React.MouseEvent
  | React.FormEvent<HTMLInputElement>
  | React.KeyboardEvent;
type OnChangeValue = { value: InputValueType };
type InputFieldType = "checkbox" | "number" | "text";

type Props = {
  value: InputValueType;
  label: string;
  type?: InputFieldType | undefined;
  synced?: boolean;
  disabled?: boolean;
  unit?: string;
  labelStyle?: any;
  style?: any;

  onChange: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onEscape?: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onFocus?: () => void;
  onLabelClicked?: (ev: OnChangeEvent, value: OnChangeValue) => void;
};

type State = { value: InputValueType };

export default class InputField extends Component<Props, State> {
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

  renderCheckboxType = (value: InputValueType) => {
    const { onChange } = this.props;
    return (
      <Checkbox
        style={{ padding: "5px 5px" }}
        slider
        checked={
          value !== undefined && typeof value === "boolean" ? value : false
        }
        onChange={(ev, { checked }) => {
          onChange(ev, { value: checked });
        }}
      />
    );
  };

  renderInputType = (
    value: InputValueType,
    type: InputFieldType,
    fontSize: string | number,
    synced: boolean
  ) => {
    const {
      disabled,
      unit,
      onChange = () => {},
      onEscape = () => {},
      onFocus = () => {},
    } = this.props;
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Input
          style={{
            fontSize,
            height: 33,
            width: "100%",
          }}
          type={type}
          value={value === undefined ? "" : value}
          onChange={(ev, { value: rawValue }) => {
            const value =
              type === "number"
                ? rawValue === ""
                  ? ""
                  : Number(rawValue)
                : rawValue;
            synced ? this.setState({ value }) : onChange(ev, { value });
          }}
          onKeyUp={(ev: React.KeyboardEvent) => {
            switch (ev.key) {
              case "Enter":
                if (value !== "") {
                  return onChange(ev, { value });
                }
                break;
              case "Escape":
                return onEscape && onEscape(ev, { value });
              default:
                break;
            }
          }}
          onFocus={() => onFocus && onFocus()}
          disabled={disabled}
        />
        {unit && (
          <div
            style={s(t.uc, t.ls1, t.fs11, {
              marginLeft: 5,
              marginTop: 6,
              textAlign: "left",
            })}
          >
            {unit}
          </div>
        )}
      </div>
    );
  };

  render() {
    const {
      type = "text",
      label,
      labelStyle,
      style,
      value: syncedValue,
      onChange = () => {},
      onLabelClicked = () => {},
      synced = true,
    } = this.props;
    const value = synced ? this.state.value : syncedValue;
    const inSync = synced ? value === syncedValue : true;
    const fontSize = 11;
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          margin: "3px 0px",
          ...style,
        }}
      >
        <SyncIndicator
          onClick={(ev) =>
            inSync ? onLabelClicked(ev, { value }) : onChange(ev, { value })
          }
          inSync={synced ? inSync : true}
          label={label}
          style={{ ...labelStyle, fontSize }}
        />
        {type !== "checkbox"
          ? this.renderInputType(value, type, fontSize + 1, synced)
          : this.renderCheckboxType(value)}
      </div>
    );
  }
}
