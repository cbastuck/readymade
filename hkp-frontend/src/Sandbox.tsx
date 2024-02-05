import { Component } from "react";
import { Link, Location } from "react-router-dom";
import * as uuid from "uuid";

import { withRouter } from "./common";
import Runtime from "./components/Runtime";
import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "./BoardContext";
import DragProvider from "./DragContext";

import { s, t } from "./styles";
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeImpl,
  SandboxRuntimeDescriptor,
  SandboxRuntimeDescriptorMap,
  ServiceDescriptor,
  isSandboxRuntimeDescriptor,
} from "./types";
import browserRuntimeApi from "./runtime/browser/BrowserRuntimeApi";

type Props = {
  location: Location;
  boardName?: string;
  src?: string;
  data?: string;
};

type State = {
  runtime: RuntimeDescriptor | null;
  options: Options;
  url?: string;
  services?: Array<ServiceDescriptor>;
};

type Options = {
  frameless: boolean;
};

class Sandbox extends Component<Props, State> {
  runtime: RuntimeImpl | null = null;
  constructor(props: Props) {
    super(props);

    const urlProps = Object.fromEntries(
      new URLSearchParams(props.location.search)
    );
    const { frameless = "false" } = urlProps;
    this.state = {
      runtime: null,
      options: {
        frameless: frameless === "true",
      },
    };
  }

  configureService = async (serviceUuid: string, config: any) => {
    if (this.runtime) {
      return this.runtime.configureService(serviceUuid, config);
    }
  };

  fetchBoard = async () => {
    const { boardName = "Sandbox", location } = this.props;
    const urlProps = Object.fromEntries(new URLSearchParams(location.search));
    const { src = this.props.src, data = this.props.data } = urlProps; // url props override internal props
    const runtime = src
      ? await this.fetchAndParseData(src)
      : data
      ? await this.parseData(typeof data === "string" ? JSON.parse(data) : data)
      : null;

    if (!runtime) {
      throw new Error("Sandbox.fetchBoard sandbox without data source");
    }

    this.setState({
      url: src,
      runtime: {
        id: runtime.id,
        name: "Sandbox",
        type: runtime.type,
        bundles: runtime.bundles,
        state: runtime.state,
      },
      services: runtime.services,
    });

    return {
      board: { name: boardName },
      runtimes: [runtime],
      services: {
        [runtime.id]: runtime.services,
      },
      registry: {
        // [runtime.id]: registry.availableServices,
      },
    };
  };

  fetchAndParseData = async (src: string) => {
    try {
      const response = await fetch(src);
      return this.parseData(await response.json());
    } catch (err) {
      console.error("Fetched data is not valid JSON document", src, err);
    }
  };

  parseData = async (
    data: SandboxRuntimeDescriptor | SandboxRuntimeDescriptorMap
  ) => {
    const firstBrowserRuntimeData = extractFirstRuntime(data);
    if (!firstBrowserRuntimeData) {
      return;
    }

    // add an uuid to each service if this is not present
    firstBrowserRuntimeData.services.map((s) => {
      if (!s.uuid) {
        s.uuid = uuid.v4();
      }
      return s;
    });

    return firstBrowserRuntimeData;
  };

  onResult = async (
    uuid: string | null,
    result: any,
    requestId: string | null
  ) => {
    // console.log('Sandbox result', serviceUuid, result);
  };

  renderState = (
    boardContext: BoardContextState,
    options: Options,
    runtime: RuntimeDescriptor
  ) => {
    const url = this.state.url;
    return (
      <DragProvider key={`sandbox-drag-provider-${runtime.id}`}>
        <Runtime
          ref={(runtime) => (this.runtime = runtime)}
          key={`sandbox-runtime-${runtime.id}`}
          initialState={runtime.state}
          style={{ marginBottom: 5 }}
          runtime={runtime}
          frameless={options && options.frameless}
          boardContext={boardContext}
          onResult={this.onResult}
          disabledItems={["remove"]}
        />
        {url && (
          <div
            style={{
              textAlign: "right",
              marginBottom: 2,
            }}
          >
            <Link className="hkp-fnt-family" to={`/playground?src=${url}`}>
              open on playground
            </Link>
            <div style={{ height: 50 }} />
          </div>
        )}
      </DragProvider>
    );
  };

  render() {
    const { runtime, options } = this.state;
    const runtimeApis: RuntimeApiMap = {
      browser: browserRuntimeApi,
    };

    return (
      <BoardProvider
        fetchBoard={this.fetchBoard}
        runtimeApis={runtimeApis}
        fetchAfterMount={true}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext &&
            runtime &&
            this.renderState(boardContext, options, runtime)
          }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}

function extractFirstRuntime(
  data: SandboxRuntimeDescriptor | SandboxRuntimeDescriptorMap
): SandboxRuntimeDescriptor | undefined {
  if (isSandboxRuntimeDescriptor(data)) {
    return data;
  }

  const runtimesInData = Object.keys(data);
  const browserRuntimeIds = runtimesInData.filter(
    (runtimeId) => data[runtimeId].type === "browser"
  );
  const firstBrowserRuntimeId = browserRuntimeIds[0];
  if (!firstBrowserRuntimeId) {
    return;
  }

  const firstBrowserRuntimeData = data[firstBrowserRuntimeId];
  if (!firstBrowserRuntimeData || !firstBrowserRuntimeData.services) {
    return;
  }

  firstBrowserRuntimeData.id = firstBrowserRuntimeId;
  return firstBrowserRuntimeData;
}

export default withRouter(Sandbox);
