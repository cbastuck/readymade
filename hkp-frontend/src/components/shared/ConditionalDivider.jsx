import React, { Component } from "react";
import { Divider, Checkbox } from "semantic-ui-react";

export default class ConditionalDivider extends Component {
  render() {
    const { name = "", enabled = true, onChange } = this.props;
    return (
      <Divider horizontal>
        {name}
        <Checkbox
          style={{ marginLeft: 10 }}
          checked={enabled}
          onChange={(_, { checked }) => onChange(checked)}
        />
      </Divider>
    );
  }
}
