import React, { Component } from "react";

import InputField from "../../components/shared/InputField";

import { s, t } from "../../styles";

export default class InputLabelValue extends Component {
  state = {
    editLabel: null,
    renamedLabelBuffer: null,
  };

  componentDidMount() {
    const { value, label } = this.props;
    this.setState({
      label,
      value,
    });
  }

  componentDidUpdate(prevProps) {
    const { value, label } = this.props;
    if (value !== prevProps.value) {
      this.setState({ value });
    }
    if (label !== prevProps.label) {
      this.setState({ label });
    }
  }

  stopLabelEditing = () => {
    this.setState({
      editLabel: null,
      renamedLabelBuffer: null,
    });
  };

  renderEditableLabel = () => {
    const { onCommit } = this.props;
    const { value = "", editLabel, renamedLabelBuffer } = this.state || {};
    return (
      <input
        style={s(t.fs12, { width: 80 })}
        value={renamedLabelBuffer === null ? editLabel : renamedLabelBuffer}
        ref={(element) => element && element.focus()}
        onChange={(_, { value: renamedLabelBuffer }) =>
          this.setState({ renamedLabelBuffer })
        }
        onKeyDown={(e) => {
          switch (e.key) {
            case "Tab":
            case "Enter":
              onCommit({
                label:
                  renamedLabelBuffer === null ? editLabel : renamedLabelBuffer,
                value,
              });
              break;
            case "Escape":
              break;
            default:
              return; // all other keys don't set any state
          }
          this.stopLabelEditing();
        }}
        onBlur={this.stopLabelEditing}
      />
    );
  };

  render() {
    const { onCommit } = this.props;
    const { label = "", value = "", editLabel } = this.state || {};
    return (
      <InputField
        type="text"
        label={editLabel === label ? this.renderEditableLabel() : label}
        labelStyle={{ textTransform: "none" }}
        value={value}
        onChange={(_, { value }) => onCommit({ label, value })}
        onLabelClicked={() => this.setState({ editLabel: label })}
        onFocus={() => this.setState({ editLabel: undefined })}
      />
    );
  }
}
