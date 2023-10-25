import { Component } from "react";
import { Navigate } from "react-router-dom";

import { AppConsumer } from "./AppContext";
import BoardContext from "./BoardContext";
import BrowserRegistry from "./runtime/browser/BrowserRegistry";
import { loadBoard, clearBoard } from "./core/actions";

export default class Import extends Component {
  state = { board: undefined };

  doImport = async (context) => {
    if (this.isImporting) {
      return;
    }
    this.isImporting = true;

    const { location } = this.props;
    const values = Object.fromEntries(new URLSearchParams(location.search));
    const { src, board } = values;
    if (src && board) {
      const response = await fetch(src);
      const data = await response.json();
      const runtimes = data.version
        ? data.runtimes
        : Object.keys(data).map((key) => data[key]);

      for (const rt of runtimes) {
        if (rt.type === "browser") {
          rt.params = rt.params || {};

          // TODO: this might not be the registry from the
          // browser runtime which assumes ownership
          // POST/PUT endpoint to set the registry for an existing runtime
          if (!rt.params.registry) {
            const { bundles = [] } = rt.params;
            const browserRegistry = await BrowserRegistry.create(
              bundles,
              context.user
            );
            rt.params.registry = browserRegistry.availableServices;
          }

          if (rt.params.leaveOwnership !== true) {
            BoardContext.registerBrowserRuntime(board, rt.id);
          }
        }
      }
      await clearBoard(board);
      await loadBoard(board, data);
      this.setState({ board }, () => (this.isImporting = false));
    }
  };

  render() {
    const { board } = this.state;
    if (!board) {
      return (
        <AppConsumer>
          {(context) => {
            this.doImport(context);
            return false;
          }}
        </AppConsumer>
      );
    }
    return <Navigate to={`/${board}`} />;
  }
}
