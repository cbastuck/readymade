import React, { Component } from "react";

import { AppConsumer } from "../AppContext";
import BoardProvider from "../BoardContext";
import Board from "./Board";

export default class BoardWithContext extends Component {
  render() {
    const { match } = this.props;
    const { board: boardName } = match.params;
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardProvider user={appContext.user} boardName={boardName}>
            <Board appContext={appContext} />
          </BoardProvider>
        )}
      </AppConsumer>
    );
  }
}
