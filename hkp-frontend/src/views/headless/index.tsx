import { Component } from "react";

import Runtime from "../../components/Runtime";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import BoardProvider, { BoardConsumer } from "../../BoardContext";
import browserRuntimeApi from "../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../runtime/remote/RemoteRuntimeApi";
import { availableRuntimeEngines } from "../playground/common";

import build from "../../buildNumber.json";
import {
  BoardDescriptor,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "../../types";

const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
  "hookup.to/registry/browser/Crypto",
  "hookup.to/registry/browser/Fileformat",
];

export type Props = {
  callback: (data: any) => void;
  runtimeId: string;
  runtimeName: string;
  services: Array<ServiceDescriptor>;
  expanded: boolean;
};

type State = {
  defaultRegistry?: BrowserRegistry;
};

export default class Headless extends Component<Props, State> {
  state: State = {};
  boardContext: BoardProvider | null = null;
  runtimeRef: Runtime | null = null;

  static buildVersion() {
    return build.version;
  }

  constructor(props: Props) {
    super(props);
  }

  getFirstRuntime = () => {
    return this.boardContext?.state?.runtimes?.[0];
  };

  configure = (serviceId: string, config: any) => {
    const runtime = this.getFirstRuntime();
    if (runtime && this.boardContext) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      if (scope && api) {
        api.configureService(scope, { uuid: serviceId }, config);
      }
    }
  };

  configuration = (serviceId: string) => {
    const runtime = this.getFirstRuntime();
    if (runtime && this.boardContext) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      if (api && scope) {
        return api.getServiceConfig(scope, { uuid: serviceId });
      }
    }
  };

  processService = (serviceId: string, params: any) => {
    const runtime = this.getFirstRuntime();
    if (runtime && this.boardContext) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      if (scope && api) {
        return api.processService(scope, { uuid: serviceId }, params, null);
      }
    }
  };

  process = (params: any, serviceId: string) => {
    const runtime = this.getFirstRuntime();
    if (runtime && this.boardContext) {
      const [scope, api] = this.boardContext.getRuntimeScopeApi(runtime.id);
      if (scope && api) {
        return api.processRuntime(scope, params, { uuid: serviceId });
      }
    }
  };

  onResult = async (runtimeId: string | null, data: any) => {
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
      BrowserRegistry.create(defaultBundles).then((defaultRegistry) => {
        this.setState({ defaultRegistry });
      });
      return false;
    }

    const runtime: RuntimeDescriptor = {
      id: runtimeId,
      name: runtimeName,
      type: "browser",
    };

    const onFetchBoard = async (): Promise<BoardDescriptor> => {
      return {
        runtimes: [runtime],
        services: { [runtimeId]: services },
        boardName: "headless-board",
        registry: {},
      };
    };

    const runtimeApis = {
      browser: browserRuntimeApi,
      remote: remoteRuntimeApi,
    };

    const processRuntimeByName = async () => {
      console.warn("processRuntimeByName not implemented in headless");
    };

    return (
      <BoardProvider
        ref={(context) => (this.boardContext = context)}
        user={null}
        boardName="headless-board"
        fetchBoard={onFetchBoard}
        isRuntimeInScope={() => true}
        runtimeApis={runtimeApis}
        isActionAvailable={() => false}
        availableRuntimeEngines={availableRuntimeEngines}
        fetchAfterMount={true}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext && (
              <Runtime
                ref={(rt) => (this.runtimeRef = rt)}
                boardContext={boardContext}
                runtime={runtime}
                expanded={expanded}
                headless={!expanded}
                onResult={this.onResult}
                initialState={{}}
                processRuntimeByName={processRuntimeByName}
              />
            )
          }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}
/*
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
*/
