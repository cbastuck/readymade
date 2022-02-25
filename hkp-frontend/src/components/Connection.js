import React, { Component } from "react";
import joint from "jointjs";

export default class Connection extends Component {
  componentDidMount() {
    const link = new joint.shapes.standard.Link();
    link.source(rect);
    link.target(rect2);
    link.addTo(this.graph);
  }

  render() {
    return <div>Hoy</div>;
  }
}
