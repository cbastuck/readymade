import { Component } from "react";

import Runtime from "../../components/Runtime";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import BoardProvider, { BoardConsumer } from "../../BoardContext";
import browserRuntimeApi from "../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../runtime/remote/RemoteRuntimeApi";
import { availableRuntimes } from "../playground/common";

import build from "../../buildNumber.json";

const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
  "hookup.to/registry/browser/Crypto",
  "hookup.to/registry/browser/Fileformat",
];

export default class Headless extends Component {
  state = {};

  static buildVersion() {
    return build.version;
  }

  constructor(props) {
    super(props);
    BrowserRegistry.create(defaultBundles).then((defaultRegistry) =>
      this.setState({ defaultRegistry })
    );
  }

  getFirstRuntime = () => {
    return this.boardContext?.state?.runtimes?.[0];
  };

  configure = (serviceId, config) => {
    const runtime = this.getFirstRuntime();
    if (runtime) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      api.configureService(scope, { uuid: serviceId }, config);
    }
  };

  configuration = (serviceId) => {
    const runtime = this.getFirstRuntime();
    if (runtime) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      return api.getServiceConfig(scope, { uuid: serviceId });
    }
  };

  processService = (serviceId, params) => {
    const runtime = this.getFirstRuntime();
    if (runtime) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      return api.processService(scope, { uuid: serviceId }, params);
    }
  };

  process = (params, serviceId) => {
    const runtime = this.getFirstRuntime();
    if (runtime) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      return api.processRuntime(scope, params, { uuid: serviceId });
    }
  };

  onResult = (runtimeId, data) => {
    const { callback } = this.props;
    if (callback) {
      callback(data);
    } else {
      console.log("No callback set, printing result from:", runtimeId, data);
    }
  };

  render() {
    const { runtimeId, runtimeName, services, expanded = false } = this.props;
    const { defaultRegistry } = this.state;
    if (!defaultRegistry) {
      return false;
    }

    const runtime = { id: runtimeId, name: runtimeName, type: "browser" };
    const emptyFunc = () => {};

    const onFetchBoard = () => {
      return {
        runtimes: [runtime],
        services: { [runtimeId]: services },
        boardName: "headless-board",
      };
    };

    const runtimeApis = {
      browser: browserRuntimeApi,
      remote: remoteRuntimeApi,
    };
    return (
      <BoardProvider
        ref={(context) => (this.boardContext = context)}
        user={{}}
        boardName="headless-board"
        fetchBoard={onFetchBoard}
        isRuntimeInScope={() => true}
        runtimeApis={runtimeApis}
        removeRuntime={emptyFunc}
        newBoard={emptyFunc}
        clearBoard={emptyFunc}
        saveBoard={emptyFunc}
        isActionAvailable={() => false}
        serializeBoard={emptyFunc}
        onAction={emptyFunc}
        onRemoveService={emptyFunc}
        availableRuntimes={availableRuntimes}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext && (
              <Runtime
                ref={(rt) => (this.runtime = rt)}
                boardContext={boardContext}
                runtime={runtime}
                expanded={expanded}
                headless={!expanded}
                onResult={this.onResult}
              />
            )
          }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}

Headless.defaultProps = {
  runtimeId: "d5a48a72-b077-4d1e-83de-4be8f64bc3e8",
  runtimeName: "Headless runtime",
  services: [
    {
      serviceId: "hookup.to/service/timer",
      serviceName: "Timer",
      uuid: "fb58b71d-dccd-4bfe-afac-5d52b9bc1a9e",
      running: true,
      periodic: true,
      periodicValue: 1,
      periodicUnit: "s",
    },
  ],
};
