import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react'

export default class AxcountDropdown extends Component {

  render() {
    const { label, onAction } = this.props;

    return (
      <Menu
        className="right"
      >
        <Dropdown
          text={label}
          className='link item'
        >
          <Dropdown.Menu>
            <Dropdown.Item
              onClick={() => onAction({
                type: 'logout'
              })}
            >
              Logout
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Menu>
    )
  }
}
