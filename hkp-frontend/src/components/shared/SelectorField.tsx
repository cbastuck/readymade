import React, { Component } from "react";
import { Dropdown } from "semantic-ui-react";

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
  maxHeight?: string;

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

  renderDropdown = () => {
    const {
      options: optionsMap,
      value,
      placeholder,
      uppercaseValues,
      disabled,
      maxHeight = "200px",
      onChange,
    } = this.props;
    const options = Object.keys(optionsMap).map((key) => ({
      key,
      text: optionsMap[key],
      value: optionsMap[key],
    }));

    return (
      <Dropdown
        className="selector-field-selected-value"
        style={{
          minHeight: 0,
          height: 33,
          paddingTop: 6,
          width: "100%",
          paddingRight: 10,
          border: "solid 1px rgba(34, 36, 38, 0.15)",
          borderRadius: 3,
          paddingLeft: 5,
        }}
        disabled={disabled}
        placeholder={value ? optionsMap[value] : placeholder}
        value={value || undefined}
      >
        <Dropdown.Menu style={{ maxHeight, overflowY: "auto", width: "100%" }}>
          {options.map((option, idx) => (
            <Dropdown.Item
              key={option.key}
              style={{
                backgroundColor: idx % 2 ? "#f9f9f9" : "white",
              }}
              onClick={(ev: React.MouseEvent) => {
                onChange && onChange(ev, { value: option.key, index: idx });
                this.setState({ optionsVisible: false });
              }}
            >
              <span
                style={{
                  textTransform: uppercaseValues ? "uppercase" : "initial",
                }}
              >
                {option.text}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  render() {
    const { value } = this.state;
    const {
      label,
      value: syncedValue,
      style = {},
      minWidth = undefined, //"100%",
      uppercaseKeys = false,
      labelStyle = {},
      onChange,
    } = this.props;
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

        {this.renderDropdown()}
      </div>
    );
  }
}
