import React, { Component } from "react";
import { Navigate } from "react-router-dom";

import { generateRandomName } from "../core/board";

class BuildBoard extends Component {
  render() {
    const name = generateRandomName();
    return <Navigate to={`/${name}`} />;
  }
}
export default BuildBoard;
