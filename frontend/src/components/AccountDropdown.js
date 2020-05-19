import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import { Dropdown, Icon } from 'semantic-ui-react';

export default class AccountDropdown extends Component {

  renderLogin() {
    const { currentUser, onAction } = this.props;
    return (
      currentUser ? 
        (
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
    );
  }

  render() {
    const { currentUser} = this.props;
    const dropDownText = currentUser || <Icon name="user" />
    return (
      <Dropdown
        text={dropDownText}
        className='link item right'
      >
        <Dropdown.Menu>
          {
            this.renderLogin()
          }
        </Dropdown.Menu>
      </Dropdown>
    )
  }
}
