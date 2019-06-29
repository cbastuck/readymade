import React, { Component } from 'react';

import { Link } from 'react-router-dom';
import { Dropdown, Menu } from 'semantic-ui-react'

import { AppConsumer } from '../AppContext';
import AccountDropdown from '../components/AccountDropdown';

import './Welcome.css';

export default class Welcome extends Component {
  render() {
    return (
      <div className="hero-image">
        <AppConsumer>
        {
          appContext => (
            <Menu>
              {
                appContext.username && (
                  <Dropdown
                    text={`Board Menu`}
                    className='link item'
                  >
                  </Dropdown>
                )
              }

              <Menu
                className="right button"
              > 
                <Link to="/new" className="login-link">Login</Link>
              </Menu>
            </Menu>
          )
        }
        </AppConsumer>
        <div className="hero-text">
          <h1 
            style={{fontSize: 50}}
          >
            Build Services
          </h1>
          <p className="hero-claim">using other Services</p>
          <Link to="/new">
            <button> Start </button>
          </Link>
        </div>
      </div>
    );
  }
}