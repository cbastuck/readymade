import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import g from 'unique-names-generator'

import { AppConsumer } from '../AppContext';
import { redirectToLogin } from '../core/actions';

class BuildBoard extends Component {
  render() {
    return (
      <AppConsumer>
        {
          appContext => {
            if (appContext.token) {
              return <Redirect to={g.generate('-')} />;
            } else {
              return redirectToLogin();
            }
          }
        }
      </AppConsumer>
    );
  }
}
export default BuildBoard;
