import React, { Component } from "react";
import { Dropdown, Menu } from "semantic-ui-react";
import { Link } from "react-router-dom";

import { AppConsumer } from "../AppContext";
import { BoardConsumer } from "../BoardContext";
import AccountDropdown from "./AccountDropdown";

import "./HeaderMenu.css";

export default class HeaderMenu extends Component {
  renderHomeIcon() {
    return (
      <div
        style={{
          paddingTop: 7,
          paddingLeft: 4,
          paddingRight: 1,
          marginLeft: 4,
          marginRight: 1,
        }}
      >
        <Link to="/">
          <img
            height={25}
            src="/assets/shutterstock_1196210650.png"
            alt="Hookup"
          />
        </Link>
      </div>
    );
  }

  renderNavigation(appContext) {
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
        <span> </span>
        {username && (
          <Link to="/dashboard" style={navItemStyle}>
            {/*appContext.user.username*/}Home
          </Link>
        )}
        {!username && (
          <Link to="/playground" style={navItemStyle}>
            Playground
          </Link>
        )}
        <Link to="/examples" style={navItemStyle}>
          Examples
        </Link>
        <Link to="/docs" style={navItemStyle}>
          Docs
        </Link>
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
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  renderRuntimeMenu(availableRuntimes, boardContext) {
    const { showRuntimeMenuHighlighted = false } = this.state || {};
    const wideViewMode = boardContext.appViewMode === "wide";
    const options = availableRuntimes.map((o) => ({
      key: o.name,
      value: o.args,
      text: o.name,
    }));
    return (
      <div
        id="runtime-dropdown"
        style={{
          marginLeft: 10,
          marginTop: 3,
        }}
        onClick={(ev) => {
          this.setState({ showRuntimeMenuHighlighted: true });
          this.dropdown.open(ev);
        }}
      >
        <Dropdown
          compact={!wideViewMode}
          style={{ border: showRuntimeMenuHighlighted && "solid 2px #4284C4" }}
          ref={(dropdown) => (this.dropdown = dropdown)}
          options={options}
          placeholder={wideViewMode ? "Add Runtime" : "Runtime"}
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value) {
              boardContext.addRuntime(...value.split(","));
              this.dropdown.clearValue();
              this.setState({ showRuntimeMenuHighlighted: false });
            }
          }}
        />
      </div>
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
    const { availableRuntimes, board } = this.props;
    return (
      <AppConsumer>
        {(appContext) => (
          <BoardConsumer>
            {(boardContext) => (
              <Menu
                style={{
                  boxShadow: "none",
                  border: "none",
                }}
              >
                {this.renderHomeIcon()}
                {appContext.user && this.renderBoardMenu(board, boardContext)}
                {availableRuntimes &&
                  this.renderRuntimeMenu(availableRuntimes, boardContext)}
                {(!availableRuntimes || boardContext.appViewMode === "wide") &&
                  this.renderNavigation(appContext)}
                {appContext && this.renderAccountMenu(appContext, boardContext)}
              </Menu>
            )}
          </BoardConsumer>
        )}
      </AppConsumer>
    );
  }
}
