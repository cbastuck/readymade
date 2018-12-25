import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react'

import { AppConsumer } from '../AppContext';
import AccountDropdown from './AccountDropdown';
import {
  currentBoardName,
} from '../core/actions';

export default class ServiceDropdown extends Component {

  onAction = action => {
    switch(action.type) {
      default:
        this.props.onAction(action);
    }
  }

  render() {
    const { registry } = this.props;
    if (!registry) {
      return false;
    }
    return (
      <AppConsumer>
        {
          appContext => (
            <Menu>
              <Dropdown
                text={`Board Menu`}
                className='link item'
              >
                <Dropdown.Menu>
                  <Dropdown.Header>
                    {currentBoardName()}
                  </Dropdown.Header>
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
              <Dropdown
                text='Add Services'
                search
                selection
                pointing
                className='link item'
                onSearchChange={e => console.log('search', e.target.value)}
              >
                <Dropdown.Menu>
                  {
                    Object.keys(registry).map(runtimeName =>
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
                        <Dropdown.Divider
                          key={`${runtimeName}.devider`}
                        />
                      ]
                    )
                  }
                </Dropdown.Menu>
              </Dropdown>
              <AccountDropdown
                label={appContext.username || 'Account'}
                onAction={action => {
                  if (action.type === 'logout') {
                    appContext.logout();
                  } else {
                    this.onAction(action)
                  }
                }}
              />
            </Menu>
          )
        }
      </AppConsumer>
    );
  }
}
