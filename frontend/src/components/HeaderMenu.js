import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react';
import { Link } from 'react-router-dom';

import { redirectTo } from '../core/actions';
import { AppConsumer } from '../AppContext';
import { BoardConsumer } from '../BoardContext';
import AccountDropdown from './AccountDropdown';

import './HeaderMenu.css';

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
      textTransform: 'uppercase',
    };

    const username = appContext && appContext.user && appContext.user.username;
    return (
      <div
        style={{
          marginTop: 10,
          width: '100%',
          textAlign: 'right',
          marginRight: 10,
        }}
      >
        { /* <span style={navItemStyle}>Go to:</span> */ }
        <span>  </span>
        {
          username && (
            <Link to="/dashboard" style={navItemStyle}>
              {/*appContext.user.username*/}Home
            </Link>
          )
        }
        {
          !username && (
            <Link to="/playground" style={navItemStyle}>
              Playground
            </Link>
          )
        }
        <Link to="/examples" style={navItemStyle}>
          Examples
        </Link>
        <Link to="/docs" style={navItemStyle}>
          Docs
        </Link>
      </div>
    );
  }

  renderBoardMenu(board) {
    const menuItemStyle= { 
      fontSize: 10, 
      textTransform: 'uppercase',
      letterSpacing: 1,
    };
    return (
      <Dropdown
        text={board ? board : 'Board'}
        className='link item'
        style={{ 
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          paddingLeft: 5,
          paddingRight: 8,
        }}
      >
        <Dropdown.Menu>
          <Dropdown.Item 
            onClick={() => redirectTo('/new')}
          >
            <span style={menuItemStyle}>
              New Board
            </span>
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => this.onAction({
              type: 'clearBoard'
            })}
            disabled={!board}
          >
            <span style={menuItemStyle}>
              Clear Board
            </span>
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => this.onAction({
              type: 'shareBoard',
            })}
            disabled={!board}
          >
            <span style={menuItemStyle}>Share Board</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  renderRuntimeMenu(availableRuntimes, boardContext) {
    const wideViewMode = boardContext.appViewMode === 'wide';
    const options = availableRuntimes.map(o => ({ key: o.name, value: o.args, text: o.name }));
    return (
      <div
        id="runtime-dropdown"
        style={{ 
          marginLeft: 10,
          marginTop: 3,
        }}
      >
        <Dropdown
          compact={!wideViewMode}
          ref={dropdown => this.dropdown = dropdown}
          options={options}
          placeholder={wideViewMode ? 'Add Runtime' : 'Runtime'}
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value) {
              this.props.addRuntime(...value.split(','));
              this.dropdown.clearValue();
            }
          }}
        />
      </div>
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
    const { 
      availableRuntimes, 
      board, 
    } = this.props;
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
                    }}
                  >
                    { this.renderHomeIcon() }
                    {
                      appContext.user && this.renderBoardMenu(board)
                    }
                    {
                      availableRuntimes && this.renderRuntimeMenu(availableRuntimes, boardContext)
                    }
                    { 
                      (!availableRuntimes || (boardContext.appViewMode === 'wide')) && 
                        this.renderNavigation(appContext)
                    }
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
