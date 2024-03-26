import React, { Component } from "react";
import { Input, Label, Button } from "semantic-ui-react";

import { configureService, getServiceConfiguration } from "../../core/actions";

const lineStyle = {
  textAlign: "left",
  margin: 10,
};

export default class FileS3UI extends Component {
  state = {};

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    this.setState(config);
  };

  render() {
    const { board, service } = this.props;
    return (
      <div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>User</Label>
          <Input
            value={this.state.user}
            onChange={(_, { value }) => {
              this.setState({ user: value });
            }}
          />
        </div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>Bucket</Label>
          <Input
            value={this.state.bucket}
            onChange={(_, { value }) => {
              this.setState({ bucket: value });
            }}
          />
        </div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>File</Label>
          <Input
            value={this.state.file}
            onChange={(_, { value }) => {
              this.setState({ file: value });
            }}
          />
        </div>
        <div style={lineStyle}>
          <Button
            style={{ width: "100%" }}
            onClick={() => configureService(board, service, this.state)}
          >
            Set
          </Button>
        </div>
      </div>
    );
  }
}
