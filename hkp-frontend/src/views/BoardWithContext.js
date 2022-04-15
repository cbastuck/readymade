import React, { Component } from "react";

import { AppConsumer } from "../AppContext";
import BoardProvider from "../BoardContext";
import Board from "./Board";
import { withRouter } from "../common";

class BoardWithContext extends Component {
  render() {
    const { match } = this.props;
    const { board: boardName } = match.params;
    const availableRuntimes = [
      { name: "browser", type: "browser" },
      { name: "hookup", type: "node" },
    ];
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardProvider
            user={appContext.user}
            boardName={boardName}
            availableRuntimes={appContext.token && availableRuntimes}
          >
            <Board appContext={appContext} />
          </BoardProvider>
        )}
      </AppConsumer>
    );
  }
}

export default withRouter(BoardWithContext);
