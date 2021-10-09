import React, { Component } from "react";

import Runtime from "../../components/Runtime";

export default class HeadlessPlayground extends Component {
  onResult = (runtime, data) => {
    console.log("on result", runtime, data);
  };

  renderPlayground = (boardContext, runtime) => {
    return <div></div>;
  };

  render() {
    const boardContext = {};
    const runtime = {
      services: [
        {
          serviceId: "hookup.to/service/timer",
          serviceName: "Timer",
          uuid: "fb58b71d-dccd-4bfe-afac-5d52b9bc1a9e",
          running: true,
        },
      ],
    };
    return (
      <Runtime
        key={`headless-playground-${runtime.id}`}
        ref={(rt) => (this.runtime = rt)}
        boardContext={boardContext}
        runtime={runtime}
        onResult={this.onResult.bind(this, runtime)}
      />
    );
  }
}
