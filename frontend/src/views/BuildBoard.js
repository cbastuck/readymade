import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import { generate } from "unique-names-generator";

class BuildBoard extends Component {
  render() {
    const name = generate("-").split("-").slice(1).join("-");
    return <Redirect to={name} />;
  }
}
export default BuildBoard;
