import React, { Component } from "react";

import SyncIndicator from "./SyncIndicator";

import "./SelectorField.css";

type OnChangeValue = {
  value: string;
  index?: number;
};

type Options = { [key: string]: string };

type Props = {
  value: string | null;
  label: string;
  options: Options;

  uppercaseValues?: boolean;
  uppercaseKeys?: boolean;
  disabled?: boolean;
  highlight?: string | undefined;
  style?: object;
  minWidth?: string | number;
  placeholder?: string;
  labelStyle?: object;

  onChange: (ev: React.MouseEvent, value: OnChangeValue) => void;
  onOpen?: (options: Options) => void;
};

type State = {
  value: string;
  optionsVisible: boolean;
  highlight?: string;
};

export default class SelectorField extends Component<Props, State> {
  state: State = {
    value: "",
    optionsVisible: false,
  };

  componentDidMount() {
    const { value } = this.props;
    if (value) {
      this.setState({ value });
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { value, highlight } = this.props;
    if (value && value !== prevProps.value) {
      this.setState({ value });
    }

    if (highlight !== prevProps.highlight) {
      this.setState({ highlight });
    }
  }

  renderOptions = () => {
    const {
      label = "",
      onChange = undefined,
      options = {},
      highlight = undefined,
      uppercaseValues = true,
    } = this.props;
    return (
      <div
        style={{
          textAlign: "left",
          textTransform: uppercaseValues ? "uppercase" : "initial",
          backgroundColor: "white",
          position: "absolute",
          zIndex: 2000003,
          margin: "0px -5px",
        }}
      >
        {Object.keys(options).map((key, idx) => (
          <div
            key={`${label}.${key}.${idx}`}
            className="selector-field-option"
            style={{
              cursor: "pointer",
              fontSize: 13,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              padding: "3px 10px",
              backgroundColor: highlight === key ? "#8aa1b733" : undefined,
            }}
            onClick={(ev: React.MouseEvent) => {
              onChange && onChange(ev, { value: key, index: idx });
              this.setState({ optionsVisible: false });
            }}
          >
            {options[key]}
          </div>
        ))}
      </div>
    );
  };

  render() {
    const { value, optionsVisible } = this.state;
    const {
      label,
      onChange,
      onOpen,
      disabled = false,
      value: syncedValue,
      options = {},
      style = {},
      minWidth = undefined, //"100%",
      placeholder = "",
      uppercaseValues = true,
      uppercaseKeys = true,
      labelStyle = {},
    } = this.props;
    const text = options[value];
    const fontSize = 11;
    const useDefaultLabel = typeof label !== "object";
    return (
      <div
        style={{
          ...style,
          width: "100%",
          display: "flex",
          flexDirection: "row",
          minWidth,
        }}
      >
        {useDefaultLabel ? (
          <SyncIndicator
            onClick={(ev: React.MouseEvent) =>
              onChange && onChange(ev, { value })
            }
            inSync={value === syncedValue}
            label={label}
            style={{
              textTransform: uppercaseKeys ? "uppercase" : undefined,
              letterSpacing: 1,
              fontSize,
              ...labelStyle,
            }}
          />
        ) : (
          label
        )}
        <div
          style={{
            textTransform: uppercaseValues ? "uppercase" : "initial",
            fontSize: 12,
            padding: 8,
            border: "solid 1px #DDD",
            borderRadius: 3,
            flexGrow: 3,
            height: 33,
            textAlign: "left",
            whiteSpace: "nowrap",
            position: "relative",
            left: -2,
            cursor: disabled ? "not-allowed" : "pointer",
            backgroundColor: disabled ? "lightgray" : undefined,
            color: disabled ? "darkgray" : undefined,
            minHeight: optionsVisible ? "100px" : undefined,
            overflowY: optionsVisible ? "auto" : "hidden",
            overflowX: "hidden",
          }}
          onClick={() =>
            !disabled &&
            this.setState(
              { optionsVisible: !optionsVisible },
              () => onOpen && onOpen(options)
            )
          }
        >
          {`${text || placeholder}`}
          <span style={{ marginLeft: 5 }}> ⬇ </span>
          {optionsVisible && this.renderOptions()}
        </div>
      </div>
    );
  }
}
