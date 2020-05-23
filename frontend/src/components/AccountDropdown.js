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
    const { currentUser = ''} = this.props;
    const icon = (
      <div>
        <Icon name="user" style={{ margin: "0px 10px" }}/> 
        {currentUser}
      </div>
    );
    return (
      <Dropdown
        icon={icon}
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
