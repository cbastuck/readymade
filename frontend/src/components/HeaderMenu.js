import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react'
import { Link } from 'react-router-dom';

import { AppConsumer } from '../AppContext';
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
        text={`Board Menu`}
        className='link item'
      >
        <Dropdown.Menu>
          <Dropdown.Header>
            {board}
          </Dropdown.Header>
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
          >
            Clear Board
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => this.onAction({
              type: 'showQRCode',
            })}
          >
            Show QR Code
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  renderServiceMenu(registry) {
    const runtimes = registry ? Object.keys(registry) : [];
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
          {
            runtimes.map((runtimeName, runtimeIdx) =>
              [
                <Dropdown.Header
                  key={`${runtimeName}.header`}
                >
                  {runtimeName}
                </Dropdown.Header>,
                registry[runtimeName].map(service =>
                  <Dropdown.Item
                    key={`${runtimeName}.${service.serviceId}`}
                    onClick={() => this.props.addService(service)}
                  >
                    {service.serviceName}
                  </Dropdown.Item>
                ),
                (runtimeIdx + 1 < runtimes.length) && <Dropdown.Divider
                  key={`${runtimeName}.devider`}
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
            <Menu>
              {
                appContext.username && this.renderBoardMenu(board, savedBoards)
              }
              {
                registry && this.renderServiceMenu(registry)
              }
              {
                appContext && this.renderAccountMenu(appContext)
              }
            </Menu>
          )
        }
      </AppConsumer>
    );
  }
}
