
import React, { Component, createContext } from'react';

import {
  restoreToken,
  processToken,
  setToken
} from './core/Auth';
import {
  redirectToLogin,
} from './core/actions';

const { Provider, Consumer: AppConsumer } = createContext();

class AppContext extends Component {

  constructor(props) {
    super(props);

    const { token, username } = processToken(restoreToken());
    this.state = {
      // state members
      token,
      username,

      // modifying functions
      updateToken: this.updateToken,
      logout: this.logout
    };
  }

  updateToken = incomingToken => {
    return new Promise(resolve => {
      const { token, username } = processToken(incomingToken);
      if (token) {
        const currentToken = restoreToken();
        if (currentToken !== incomingToken) {
          setToken(incomingToken)
          setTimeout(
            () => this.setState(
              { token, username },
              resolve
            )
          );
        } else {
          return resolve();
        }
      }
    });
  }

  logout = async () => {
    await this.updateToken();
    redirectToLogin();
  }

  render() {
    return (
      <Provider
        value={{
          ...this.state
        }}
      >
        { this.props.children }
      </Provider>
    );
  }
}

export { AppConsumer };
export default AppContext;
