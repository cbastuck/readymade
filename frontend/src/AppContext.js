
import React, { Component, createContext } from'react';
import moment from 'moment';

import { validateToken } from './Auth';

const { Provider, Consumer: AppConsumer } = createContext();

function getCookie(key) {
    const cookieKey = `${key}=`;
    const cookies = document.cookie.split(';');
    const value = cookies.find(c => c.includes(cookieKey));
    return value && value.split(cookieKey)[1];
}

function setCookie(key, value, expCount, expUnit) {
  if (value) {
    const exp = moment.utc().add(expCount, expUnit).toString();
    const cookie = `${key}=${value}; expires=${exp}`;
    document.cookie = cookie;
  }
}

function removeCookie(key) {
  if (getCookie(key)) {
    setCookie(key, "removed", -100, 'y');
  }
}

class AppContext extends Component {

  constructor(props) {
    super(props);

    const { token, username } = this.processToken(getCookie('token'));
    this.state = {
      // state members
      token,
      username,

      // modifying functions
      updateToken: this.updateToken
    };
  }

  processToken = incomingToken => {
    const { token, decoded } = validateToken(incomingToken);
    if (!token && getCookie('token')) {
      return removeCookie('token');
    }
    return { token, username: decoded && decoded.nickname };
  }

  updateToken = incomingToken => {
    const { token, username } = this.processToken(incomingToken);
    if (token) {
      setTimeout(
        () => this.setState({ token, username },
          () => setCookie('token', this.state.token, 1, 'd')
        )
      );
    }
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
