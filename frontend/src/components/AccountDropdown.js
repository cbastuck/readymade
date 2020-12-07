import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import { Dropdown, Icon } from 'semantic-ui-react';

import { s, t } from '../styles';

export default class AccountDropdown extends Component {

  renderLogin() {
    const { currentUser, onAction } = this.props;
    const fontStyle = s(t.uc, t.ls1, t.fs11 );
    return (
      currentUser ? 
        (
          <Dropdown.Item
            onClick={() => onAction({
              type: 'logout'
            })}
          >
            <span style={fontStyle}> 
              Logout 
            </span>
          </Dropdown.Item>
        ) : (
          <Link to="/new">
            <Dropdown.Item>
              <span style={fontStyle}> 
                Login 
              </span>
            </Dropdown.Item>
          </Link>
        )
    );
  }

  render() {
    const { currentUser = ''} = this.props;
    const icon = (
      <div>
        <Icon name="user" style={{ margin: "0px 5px" }}/> 
        {currentUser}
      </div>
    );
    return (
      <Dropdown
        style={{ width: 85, paddingLeft: 10 }}
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
