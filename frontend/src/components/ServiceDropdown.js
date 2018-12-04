import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react'

import 'semantic-ui-css/semantic.min.css';

export default class ServiceDropdown extends Component {

  render() {
    const { registry } = this.props;
    if (!registry) {
      return false;
    }

    return (
      <Menu>
    <Menu.Item>Home</Menu.Item>
    <Dropdown
      text='Services'
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
                  {service.serviceId}
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
  </Menu>
    );
  }
}
