import React, { Component } from "react";

import Template from "../Template";
import { renderSceneExample } from "./Runtime";

export default class BoardDocumentation extends Component {
  renderBoardExample = () => {
    return (
      <div
        style={{
          marginTop: 20,
          marginRight: 30,
          width: 300,
          padding: 5,
        }}
      >
        {renderSceneExample("Runtime A")}
        <div />
        {renderSceneExample("Runtime B")}
      </div>
    );
  };

  render() {
    return (
      <Template title="Board">
        <div
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          {this.renderBoardExample()}
        </div>
      </Template>
    );
  }
}
