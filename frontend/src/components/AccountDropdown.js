import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import { Dropdown } from 'semantic-ui-react';

export default class AccountDropdown extends Component {

  render() {
    const { currentUser, onAction } = this.props;

    return (
      <Dropdown
        text={currentUser || 'Account'}
        className='link item right'
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
              <Link to="/new">
                <Dropdown.Item>
                  Login
                </Dropdown.Item>
              </Link>
            )
          }
        </Dropdown.Menu>
      </Dropdown>
    )
  }
}
