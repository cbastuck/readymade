import { Component } from "react";
import { Link } from "react-router-dom";
import * as uuid from "uuid";

import { withRouter } from "./common";
import Runtime from "./components/Runtime";
import BoardProvider, { BoardConsumer } from "./BoardContext";
import DragProvider from "./DragContext";
import BrowserRuntime from "./runtime/BrowserRuntime";
import { s, t } from "./styles";

class Sandbox extends Component {
  constructor(props) {
    super(props);

    const urlProps = Object.fromEntries(
      new URLSearchParams(props.location.search)
    );
    const { frameless = "false" } = urlProps;

    this.state = {
      runtime: undefined,
      options: {
        frameless: frameless === "true" || frameless === true,
      },
    };
  }

  configureService = (serviceUuid, config) => {
    if (this.runtime) {
      this.runtime.configureService(serviceUuid, config);
    }
  };

  fetchData = async () => {
    const { boardName = "Sandbox", location } = this.props;
    const urlProps = Object.fromEntries(new URLSearchParams(location.search));
    const { src = this.props.src, data = this.props.data } = urlProps; // url props override internal props

    const runtime = src
      ? await this.fetchAndParseData(src)
      : data
      ? await this.parseData(typeof data === "string" ? JSON.parse(data) : data)
      : null;

    if (runtime === null) {
      throw new Error("Sandbox.fetchData sandbox without data source");
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

    const registry = await BrowserRuntime.initRegistry(runtime.bundles);
    return {
      board: { name: boardName },
      runtimes: [runtime],
      services: {
        [runtime.id]: runtime.services,
      },
      registry: {
        [runtime.id]: registry.availableServices,
      },
    };
  };

  fetchAndParseData = async (src) => {
    try {
      const response = await fetch(src);
      return this.parseData(await response.json());
    } catch (err) {
      console.error("Fetched data is not valid JSON document", src, err);
    }
  };

  parseData = async (data) => {
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

  onResult = (serviceUuid, result) => {
    // console.log('Sandbox result', serviceUuid, result);
  };

  renderState = (boardContext, options, runtime, onResult) => {
    if (!runtime) {
      return null;
    }

    const url = this.state.url;
    return (
      <DragProvider key={`sandbox-drag-provider-${runtime.id}`}>
        <Runtime
          key={`sandbox-runtime-${runtime.id}`}
          initialState={runtime.state}
          style={{ marginBottom: 5 }}
          ref={(runtime) => (this.runtime = runtime)}
          runtime={runtime}
          frameless={options && options.frameless}
          boardContext={boardContext}
          onResult={onResult}
          onArrangeService={null}
          disabledItems={["remove"]}
        />
        {url && (
          <div
            style={{
              textAlign: "right",
              marginBottom: 2,
            }}
          >
            <Link
              style={s(t.uc, t.ls1, t.fs12, { fontFamily: "Lato" })}
              to={`/playground?src=${url}`}
            >
              Open In Playground
            </Link>
            <div style={{ height: 50 }} />
          </div>
        )}
      </DragProvider>
    );
  };

  renderSandbox = (options, runtime, onResult) => {
    return (
      <BoardConsumer>
        {(boardContext) =>
          this.renderState(boardContext, options, runtime, onResult)
        }
      </BoardConsumer>
    );
  };

  render() {
    const { runtime, options } = this.state;
    return (
      <BoardProvider fetchData={this.fetchData}>
        {this.renderSandbox(options, runtime, this.onResult)}
      </BoardProvider>
    );
  }
}

function extractFirstRuntime(data) {
  if (data.id && data.services) {
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
