import React, { Component } from "react";
import { Input, Label, Checkbox } from "semantic-ui-react";

import { configureService, getServiceConfiguration } from "../../core/actions";
import { debounce } from "../shared/util";

export default class WebGetUI extends Component {
  state = {
    url: undefined,
    preserveInput: false,
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    const { url, preserveInput } = config;
    this.setState({ url, preserveInput });
  };

  sendConfig = debounce(async () => {
    const { board, service } = this.props;
    await configureService(board, service, this.state);
    this.update();
  });

  render() {
    const lineStyle = {
      textAlign: "left",
      margin: "8px 10px",
    };

    return (
      <div style={{ marginBottom: 15 }}>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>URL</Label>
          <Input
            style={{ marginLeft: 10 }}
            onChange={(_, { value }) => {
              this.setState({ url: value }, this.sendConfig);
            }}
            value={this.state.url || ""}
          />
        </div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>Preserve Input</Label>
          <Checkbox
            style={{ marginLeft: 10 }}
            onChange={(_, { checked }) => {
              this.setState({ preserveInput: checked }, this.sendConfig);
            }}
            checked={this.state.preserveInput}
          />
        </div>
      </div>
    );
  }
}
