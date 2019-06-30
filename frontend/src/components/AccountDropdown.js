import React, { Component } from 'react';
import { Dropdown, Menu } from 'semantic-ui-react';

import { redirectToLogin } from '../core/actions';

export default class AccountDropdown extends Component {

  render() {
    const { currentUser, onAction } = this.props;

    return (
      <Menu
        className="right"
      >
        <Dropdown
          text={currentUser || 'Account'}
          className='link item'
        >
          <Dropdown.Menu>
            {
              currentUser ? (
                <Dropdown.Item
                  onClick={() => onAction({
                    type: 'logout'
                  })}
                >
                  Logout
                </Dropdown.Item>
              ) : (
                <Dropdown.Item
                  onClick={redirectToLogin}
                >
                  Login
                </Dropdown.Item>
              )
            }
          </Dropdown.Menu>
        </Dropdown>
      </Menu>
    )
  }
}
