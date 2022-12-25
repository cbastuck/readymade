import React, { Component } from "react";
import { Dropdown, Menu } from "semantic-ui-react";
import { Link } from "react-router-dom";

import { AppConsumer } from "../../AppContext";
import { BoardConsumer } from "../../BoardContext";
import AccountDropdown from "./AccountDropdown";
import RuntimeMenu from "./RuntimeMenu";

import "./index.css";

//import { ReactComponent as IconOld } from "./assets/hkp-single-dot-second-trial-edgy.svg";
import { ReactComponent as IconH } from "./assets/hkp-single-dot-h.svg";
//import { ReactComponent as IconK } from "./assets/hkp-single-dot-k.svg";
//import { ReactComponent as IconP } from "./assets/hkp-single-dot-p.svg";
import Icon from "./assets/hkp-single-dot-second-trial-edgy.png";

export default class Toolbar extends Component {
  renderHomeIcon() {
    const IconSvg = IconH;
    return (
      <div
        style={{
          paddingTop: 7,
          paddingLeft: 1,
          paddingRight: 1,
          marginLeft: 4,
          marginRight: 1,
        }}
      >
        <Link to="/">
          {false ? (
            <img
              style={{ margin: "2px" }}
              height={22}
              src={Icon}
              alt="Hookup"
            />
          ) : (
            <div style={{ padding: "2px" }}>
              <IconSvg width={22} />
            </div>
          )}
        </Link>
      </div>
    );
  }

  renderNavigation(appContext, isCompact) {
    const navItemStyle = {
      margin: 8,
      fontSize: 11,
      textTransform: "uppercase",
    };
    const username = appContext && appContext.user && appContext.user.username;
    return (
      <div
        style={{
          marginTop: 10,
          width: "100%",
          textAlign: "right",
          marginRight: 10,
        }}
      >
        {/* <span style={navItemStyle}>Go to:</span> */}
        {username && (
          <Link to="/dashboard" style={navItemStyle}>
            {/*appContext.user.username*/}Home
          </Link>
        )}
        {isCompact && (
          <div style={{ marginRight: 3 }}>
            <Dropdown simple text="">
              <Dropdown.Menu>
                <Dropdown.Item>
                  <Link to="/docs" style={navItemStyle}>
                    Docs
                  </Link>
                </Dropdown.Item>
                <Dropdown.Item>
                  <Link to="/examples" style={navItemStyle}>
                    Examples
                  </Link>
                </Dropdown.Item>
                <Dropdown.Item>
                  <Link to="/playground" style={navItemStyle}>
                    Playground
                  </Link>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )}
        {!isCompact && (
          <Link to="/docs" style={navItemStyle}>
            Docs
          </Link>
        )}
        {!isCompact && (
          <Link to="/examples" style={navItemStyle}>
            Examples
          </Link>
        )}
        {!username && !isCompact && (
          <Link to="/playground" style={navItemStyle}>
            Playground
          </Link>
        )}
      </div>
    );
  }

  renderBoardMenu(board, boardContext) {
    const menuItemStyle = {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 1,
    };

    return (
      <Dropdown
        id="board-dropdown"
        text={board ? board : "Board"}
        className="link item"
        style={{
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
          paddingLeft: 5,
          paddingRight: 8,
        }}
      >
        <Dropdown.Menu>
          <Dropdown.Item
            onClick={() =>
              boardContext.onAction({
                type: "newBoard",
              })
            }
          >
            <span style={menuItemStyle}>New Board</span>
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() =>
              boardContext.onAction({
                type: "clearBoard",
              })
            }
            disabled={
              !boardContext || !boardContext.isActionAvailable("clearBoard")
            }
          >
            <span style={menuItemStyle}>Clear Board</span>
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() =>
              boardContext.onAction({
                type: "shareBoard",
              })
            }
            disabled={
              !boardContext || !boardContext.isActionAvailable("shareBoard")
            }
          >
            <span style={menuItemStyle}>Share Board</span>
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() =>
              boardContext.onAction({
                type: "saveBoard",
              })
            }
            disabled={
              !boardContext || !boardContext.isActionAvailable("saveBoard")
            }
          >
            <span style={menuItemStyle}>Save Board</span>
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() =>
              boardContext.onAction({
                type: "toggleBoardSync",
              })
            }
            disabled={
              !boardContext ||
              !boardContext.isActionAvailable("toggleBoardSync")
            }
          >
            <span style={menuItemStyle}>
              {this.props.boardSyncActive ? "Disable Sync" : "Board Sync"}
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  renderAccountMenu(appContext, boardContext) {
    return (
      <AccountDropdown
        currentUser={appContext.user && appContext.user.username}
        onAction={(action) => {
          if (action.type === "logout") {
            appContext.logout();
          } else {
            boardContext.onAction(action);
          }
        }}
      />
    );
  }

  render() {
    const {
      board,
      onUpdateAvailableRuntimes,
      showRuntimeMenu = false,
      isCompact = false,
    } = this.props;
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardConsumer>
            {(boardContext) => (
              <div
                style={{
                  position: "sticky",
                  left: 0,
                  top: 0,
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    marginTop: 0,
                    marginBottom: 5,
                    textAlign: "left",
                    borderBottom: "1px solid rgba(34,36,38,.15)",
                    borderTop: "1px solid #ddd",
                  }}
                >
                  <Menu
                    style={{
                      boxShadow: "none",
                      border: "none",
                    }}
                  >
                    {this.renderHomeIcon()}
                    {appContext.user &&
                      this.renderBoardMenu(board, boardContext)}

                    {showRuntimeMenu && (
                      <RuntimeMenu
                        isWideViewMode={boardContext.appViewMode === "wide"}
                        availableRuntimes={boardContext.availableRuntimes}
                        onAddAvailableRuntime={(desc) => {
                          const runtimes =
                            boardContext.addAvailableRuntime(desc);
                          onUpdateAvailableRuntimes &&
                            onUpdateAvailableRuntimes(runtimes);
                        }}
                        onRemoveAvailableRuntime={(desc) => {
                          const runtimes =
                            boardContext.removeAvailableRuntime(desc);
                          onUpdateAvailableRuntimes &&
                            onUpdateAvailableRuntimes(runtimes);
                        }}
                        onAddRuntime={({ name, type, url }) =>
                          boardContext.addRuntime(type, name, url)
                        }
                      />
                    )}

                    {this.renderNavigation(appContext, isCompact)}
                    {appContext &&
                      this.renderAccountMenu(appContext, boardContext)}
                  </Menu>
                </div>
              </div>
            )}
          </BoardConsumer>
        )}
      </AppConsumer>
    );
  }
}
