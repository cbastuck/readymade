import React, { Component } from "react";

import Template from "./Template";

import { ExampleService, ExampleServiceUI } from "./ExampleService";
import Runtime from "../../components/Runtime";

export function renderSceneExample(runtimeName) {
  const service = new ExampleService();
  const services = [
    <ExampleServiceUI
      key="example-service-1"
      service={service}
      setup={() => service}
    />,
  ];
  const runtime = {
    services,
  };
  return (
    <div
      style={{
        marginTop: 20,
        marginRight: 30,
        width: 300,
      }}
    >
      <Runtime
        runtime={runtime}
        runtimeName={runtimeName}
        services={services}
      />
    </div>
  );
}

export default class ServiceDocumentation extends Component {
  render() {
    return (
      <Template title="Runtime">
        <div style={{ height: "100%" }}>{renderSceneExample()}</div>
      </Template>
    );
  }
}
