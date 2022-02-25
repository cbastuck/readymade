import React, { Component } from "react";
import { Tab, Menu } from "semantic-ui-react";

import Login from "./Login";
import Modal from "../components/Modal";
import Runtime from "../components/Runtime";
import Toolbar from "../components/Toolbar";
import Share from "../components/Share";
import { BoardConsumer } from "../BoardContext";
import DragProvider from "../DragContext";

import { s, t } from "../styles";

export default class Board extends Component {
  state = {
    showShareDialog: false,
  };

  renderRutimesStarTopology = (boardContext, centerId) => {
    const panes = boardContext.runtimes
      .filter((rt) => rt.id !== centerId)
      .map((rt) => {
        const inScope = boardContext.isRuntimeInScope(rt);
        const menuItem = (
          <Menu.Item
            key={`rt-star-tab-${rt.id}`}
            style={s(t.fs11, { color: !inScope && "gray" })}
            name={rt.name}
            icon={!inScope && "lock"}
          />
        );
        return {
          inScope,
          menuItem,
          render: () => (
            <Tab.Pane>{this.renderRuntime(boardContext, rt)} </Tab.Pane>
          ),
        };
      });
    panes.sort((a, b) => b.inScope - a.inScope);
    const center = boardContext.runtimes.find((rt) => rt.id === centerId);
    return (
      <div>
        <Tab panes={panes} />
        <div style={{ margin: 15 }}>
          {center && this.renderRuntime(boardContext, center)}
        </div>
      </div>
    );
  };

  renderRuntimes = (boardContext) => {
    const { board = {} } = boardContext;
    const { type, centerId } = board.topology || {};
    if (type === "star") {
      return this.renderRutimesStarTopology(boardContext, centerId);
    }
    return (
      boardContext.runtimes &&
      boardContext.runtimes.map((runtime) =>
        this.renderRuntime(boardContext, runtime)
      )
    );
  };

  renderRuntime = (boardContext, runtime) => {
    return (
      <Runtime
        key={`${runtime.id}-scene`}
        runtime={runtime}
        style={{ marginBottom: 5 }}
        boardContext={boardContext}
      />
    );
  };

  onAction = (boardContext, action) => {
    const { type } = action;
    switch (type) {
      case "shareBoard":
        this.setState({ showShareDialog: true });
        break;
      default:
        boardContext.onAction(action);
        break;
    }
  };

  render() {
    const { appContext } = this.props;
    const { showShareDialog } = this.state;
    const availableRuntimes = [
      { name: "browser", args: "browser" },
      { name: "hookup", args: "node, Hookup" },
    ];
    return (
      <BoardConsumer>
        {(boardContext) => (
          <DragProvider
            style={{
              height: "100%",
              width: "100%",
            }}
          >
            <Toolbar
              onAction={this.onAction.bind(this, boardContext)}
              board={boardContext.boardName}
              availableRuntimes={appContext.token && availableRuntimes}
            />
            {!appContext.token && <Login board={boardContext.boardName} />}
            {appContext.token &&
              boardContext &&
              boardContext.runtimes &&
              this.renderRuntimes(boardContext)}
            <Modal
              title="Share Board with User"
              component={<Share board={boardContext.boardName} />}
              setOpen={(isOpen) => this.setState({ showShareDialog: isOpen })}
              isOpen={showShareDialog}
            />
          </DragProvider>
        )}
      </BoardConsumer>
    );
  }
}
