import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react'
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
          <Dropdown.Item>
            <Dropdown text="Load Board">
              <Dropdown.Menu>
                {
                  savedBoards && savedBoards.map(savedBoard => (
                    <Dropdown.Item
                      key={`restore-entry-${savedBoard}`}
                      onClick={() => this.onAction({
                        type: 'loadBoard',
                        board: savedBoard
                      })}
                    >
                      {savedBoard}
                    </Dropdown.Item>
                  ))
                }
              </Dropdown.Menu>
            </Dropdown>
          </Dropdown.Item>

          <Dropdown.Item
            disabled={!board}
            onClick={() => this.onAction({
              type: 'saveBoard'
            })}
          >
            Save Board
          </Dropdown.Item>
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
        text="Click to add Services"
        search
        pointing
        className='link item selection'
        onSearchChange={e => console.log('search', e.target.value)}
      >
      {
        <Dropdown.Menu>
          <Dropdown.Header>Runtimes</Dropdown.Header>
          <Dropdown.Item
            onClick={() => this.props.addRuntime('node', 'Hookup')}
          >
            Hookup.to
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => this.props.addRuntime('browser')}
          >
            Browser
          </Dropdown.Item>
          {
            boardContext && boardContext.runtimes
              .filter(runtime => boardContext.isRuntimeInScope(runtime))
              .map((runtime, runtimeIdx) =>
                [
                  <Dropdown.Header
                    key={`${runtime.name}.header`}
                  >
                    {runtime.name}
                  </Dropdown.Header>,
                  registry[runtime.name] && 
                  registry[runtime.name].map(service =>
                    <Dropdown.Item
                      key={`${runtime.name}.${service.serviceId}`}
                      onClick={() => this.props.addService(service)}
                    >
                      {service.serviceName}
                    </Dropdown.Item>
                  ),
                  (runtimeIdx + 1 < boardContext.runtimes.length) && <Dropdown.Divider
                    key={`${runtime.name}.devider`}
                  />
                ]
              )
          }
        </Dropdown.Menu>
      }
      </Dropdown>
    );
  }

  renderAccountMenu(appContext) {
    return (
      <AccountDropdown
        currentUser={appContext.username}
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
                      borderBottom: '1px solid rgba(34,36,38,.15)'
                    }}
                  >
                    {
                      appContext.username && this.renderBoardMenu(board, savedBoards)
                    }
                    {
                      registry && this.renderServiceMenu(registry, boardContext)
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
