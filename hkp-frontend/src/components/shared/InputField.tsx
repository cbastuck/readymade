import { Component, CSSProperties } from "react";

import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

import { s, t } from "../../styles";

type InputValueType = string | undefined;

type InputFieldType = "text" | "password";

export type Props = {
  value: InputValueType;
  label: string;
  type?: InputFieldType | undefined;
  synced?: boolean;
  disabled?: boolean;
  unit?: string;
  labelStyle?: CSSProperties;
  style?: CSSProperties;
  isExpandable?: boolean;
  className?: string;

  onChange?: (value: string) => void;
  onEscape?: (value: string) => void;
  onFocus?: () => void;
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

  renderInputType = (
    value: InputValueType,
    type: InputFieldType,
    label: string
  ) => {
    const {
      disabled,
      unit,
      onChange = () => {},
      className = "",
      isExpandable = false,
    } = this.props;

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        <SubmittableInput
          title={label}
          type={type}
          value={value === undefined ? "" : value}
          onSubmit={onChange}
          disabled={disabled}
          className={`my-0 ${className} font-menu`}
          fullWidth
          minHeight={false}
          isExpandable={isExpandable}
        />
        {unit && (
          <div
            style={s(t.ls1, t.fs12, {
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

      style,
      value: syncedValue,
      synced = true,
    } = this.props;
    const value = synced ? this.state.value : syncedValue;

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
        {this.renderInputType(value, type, label)}
      </div>
    );
  }
}
