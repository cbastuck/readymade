import React, { Component } from "react";

import { AppConsumer } from "../AppContext";
import BoardProvider from "../BoardContext";
import Board from "./Board";
import { withRouter } from "../common";

class BoardWithContext extends Component {
  render() {
    const { match } = this.props;
    const { board: boardName } = match.params;
    const defaultRuntimes = [{ name: "browser", type: "browser" }];
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardProvider
            user={appContext.user}
            boardName={boardName}
            availableRuntimes={defaultRuntimes}
          >
            <Board appContext={appContext} />
          </BoardProvider>
        )}
      </AppConsumer>
    );
  }
}

export default withRouter(BoardWithContext);
