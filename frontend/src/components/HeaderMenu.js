import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react';
import { Link } from 'react-router-dom';

import { AppConsumer } from '../AppContext';
import { BoardConsumer } from '../BoardContext';
import AccountDropdown from './AccountDropdown';

export default class HeaderMenu extends Component {

  onAction = action => {
    switch(action.type) {
      default:
        this.props.onAction(action);
    }
  }

  renderHomeIcon() {
    return (
      <div
        style={{
          paddingTop: 7,
          paddingLeft: 6,
          marginLeft: 6,
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
      margin: 10
    };
    return (
      <div
        style={{
          marginTop: 10,
          width: '100%',
          textAlign: 'right',
          marginRight: 10
        }}
      >
        <span style={navItemStyle}>Go to</span>
        <span> → </span>
        {
          appContext && appContext.user && appContext.user.username && (
            <Link to="/dashboard" style={navItemStyle}>
              {appContext.user.username}'s Boards
            </Link>
          )
        }
        <Link to="/examples" style={navItemStyle}>
          Examples
        </Link>
        <Link to="/docs" style={navItemStyle}>
          Documentation
        </Link>
      </div>
    );
  }

  renderBoardMenu(board, savedBoards) {
    return (
      <Dropdown
        text={`Board`}
        className='link item'
      >
        <Dropdown.Menu>
          {
            !!board && (
              <Dropdown.Header>
                {board}
              </Dropdown.Header>
            )
          }
          <Link to="/new">
            <Dropdown.Item>New Board</Dropdown.Item>
          </Link>
          <Dropdown.Item
            onClick={() => this.onAction({
              type: 'clearBoard'
            })}
            disabled={!board}
          >
            Clear Board
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => this.onAction({
              type: 'showQRCode',
            })}
            disabled={!board}
          >
            Share Board
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  renderServiceMenu(registry, boardContext) {
    return (
      <Dropdown
        text="Add Runtimes"
        search
        pointing
        className='link item selection'
        onSearchChange={e => console.log('search', e.target.value)}
        style={{ marginBottom: 5 }}
      >
      {
        <Dropdown.Menu>
          <Dropdown.Header>Runtimes</Dropdown.Header>
          <Dropdown.Item
            onClick={() => this.props.addRuntime('node', 'Hookup')}
          >
            Hookup
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => this.props.addRuntime('browser')}
          >
            Browser
          </Dropdown.Item>
        </Dropdown.Menu>
      }
      </Dropdown>
    );
  }

  renderAccountMenu(appContext) {
    return (
      <AccountDropdown
        currentUser={appContext.user && appContext.user.username}
        onAction={action => {
          if (action.type === 'logout') {
            appContext.logout();
          } else {
            this.onAction(action)
          }
        }}
      />
    );
  }

  render() {
    const { registry, board, savedBoards } = this.props;
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardConsumer>
              {
                boardContext => (
                  <Menu
                    style={{
                      boxShadow: 'none',
                      border: 'none',
                      borderBottom: '1px solid rgba(34,36,38,.15)',
                    }}
                  >
                    { this.renderHomeIcon() }
                    {
                      appContext.user && this.renderBoardMenu(board, savedBoards)
                    }
                    {
                      registry && this.renderServiceMenu(registry, boardContext)
                    }
                    { this.renderNavigation(appContext) }
                    {
                      appContext && this.renderAccountMenu(appContext)
                    }
                  </Menu>
                )
              }
            </BoardConsumer>
          )
        }
      </AppConsumer>
    );
  }
}
