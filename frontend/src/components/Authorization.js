import React, { Component } from 'react'

import { AppConsumer } from '../AppContext';

import { redirectToLogin } from '../core/actions';

export default class Authorization extends Component {
  componentWillUnmount() {
    this.cancelRedirect();
  }

  scheduleRedirect = () => {
    this.redirectTimer = setTimeout(redirectToLogin, 1000);
    return false;
  }

  cancelRedirect = () => {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = undefined;
    }
  }

  render() {
    this.cancelRedirect();
    return (
      <AppConsumer>
        {
          appContext => {
            if (!appContext.token) {
              return this.scheduleRedirect();
            } else {
              this.cancelRedirect();
            }
            return this.props.children;
          }
        }
      </AppConsumer>
    );
  }
}
