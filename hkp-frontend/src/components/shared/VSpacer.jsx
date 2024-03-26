import React, { Component } from "react";

export default class VSpacer extends Component {
  render() {
    const { height = 25 } = this.props;
    return <div style={{ height: Number(height) }} />;
  }
}
