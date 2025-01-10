import { CSSProperties, Component } from "react";
import { Link, Location } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import { withRouter } from "./common";
import Runtime from "./components/Runtime";
import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "./BoardContext";
import DragProvider from "./DragContext";

import {
  BoardDescriptor,
  ProcessContext,
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeImpl,
  SandboxRuntimeDescriptor,
  SandboxRuntimeDescriptorMap,
  ServiceDescriptor,
  isBoardDescriptor,
  isSandboxRuntimeDescriptor,
} from "./types";
import browserRuntimeApi from "./runtime/browser/BrowserRuntimeApi";
import Button from "./ui-components/Button";

type Props = {
  location: Location;
  boardName?: string;
  src?: string;
  data?: string;
  style?: CSSProperties;
  hidePlaygroundLink?: boolean;
  onAction: (params: any) => void;
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
        name: runtime.name,
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
      const data = await response.json();
      return this.parseData(data);
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
        s.uuid = uuidv4();
      }
      return s;
    });

    return firstBrowserRuntimeData;
  };

  onResult = async (
    _uuid: string | null,
    _result: any,
    _context?: ProcessContext | null
  ) => {
    // console.log('Sandbox result', serviceUuid, result);
  };

  processRuntimeByName = async () => {
    console.warn("processRuntimeByName not implemented in Sandbox");
  };

  renderState = (
    boardContext: BoardContextState,
    options: Options,
    runtime: RuntimeDescriptor
  ) => {
    const url = this.state.url;
    return (
      <DragProvider
        key={`sandbox-drag-provider-${runtime.id}`}
        style={{ backgroundColor: "white" }}
      >
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
          processRuntimeByName={this.processRuntimeByName}
        />

        {url && !this.props.hidePlaygroundLink && (
          <div
            style={{
              textAlign: "right",
              marginBottom: 2,
              marginRight: 2,
            }}
          >
            <Link to={`/playground?src=${url}`} target="_blank">
              <Button>open in Playground</Button>
            </Link>
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
        user={null}
        boardName={runtime?.name}
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
  data: SandboxRuntimeDescriptor | SandboxRuntimeDescriptorMap | BoardDescriptor
): SandboxRuntimeDescriptor | undefined {
  if (isSandboxRuntimeDescriptor(data)) {
    return data;
  }

  if (isBoardDescriptor(data)) {
    const rt = data.runtimes[0];
    const services = data.services[rt.id];
    return { ...rt, services };
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

const SandboxWithRouter = withRouter(Sandbox);
export default SandboxWithRouter;
