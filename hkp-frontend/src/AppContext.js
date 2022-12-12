import React, { Component, createContext } from "react";

import { restoreToken, processToken, setToken } from "./core/Auth";
import { redirectTo } from "./core/actions";

const AppCtx = createContext();
const { Provider, Consumer: AppConsumer } = AppCtx;

class AppContext extends Component {
  constructor(props) {
    super(props);

    const { token, username, userId, features } = processToken(restoreToken());
    this.state = {
      // state members
      token, // TODO: token should be in user struct below
      user: {
        username,
        userId,
        features,
      },
      notifications: [],
      pushNotification: (notification) =>
        this.setState({
          notifications: [notification, ...this.state.notifications],
        }),
      popNotification: () =>
        this.setState({ notifications: this.state.notifications.slice(1) }),
      // modifying functions
      updateToken: this.updateToken,
      logout: this.logout,
    };
  }

  updateToken = (incomingToken) => {
    return new Promise((resolve) => {
      const { token, username, userId, features } = processToken(incomingToken);
      if (token) {
        const currentToken = restoreToken();
        if (currentToken !== incomingToken) {
          setToken(incomingToken);
          setTimeout(() =>
            this.setState(
              {
                token,
                user: { username, userId, features },
              },
              resolve
            )
          );
        }
      }
      resolve();
    });
  };

  logout = async () => {
    await this.updateToken();
    redirectTo("/");
  };

  render() {
    const { children } = this.props;
    return (
      <Provider
        value={{
          ...this.state,
        }}
      >
        {children}
      </Provider>
    );
  }
}

export { AppConsumer, AppCtx };
export default AppContext;
