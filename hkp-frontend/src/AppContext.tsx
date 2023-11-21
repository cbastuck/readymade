import { Component, createContext } from "react";

import { restoreToken, processToken, setToken } from "./core/Auth";
import { redirectTo } from "./core/actions";
import { User, Notification } from "./types";

export type AppContextState = {
  token: string;
  user: User;
  notifications: Array<Notification>;
  pushNotification: (n: Notification) => void;
  popNotification: () => void;
  updateToken: (incomingToken: string) => void;
  logout: () => void;
};

type Props = {
  children: JSX.Element | JSX.Element[];
};

const AppCtx = createContext<AppContextState | null>(null);
const { Provider, Consumer: AppConsumer } = AppCtx;

class AppContext extends Component<Props, AppContextState> {
  constructor(props: Props) {
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
      pushNotification: (notification) => {
        const { tag } = notification;
        const pos = this.state.notifications.findIndex((cur) =>
          cur.tag === tag ? notification : cur
        );
        const autoClose = () => {
          const idx = this.state.notifications.indexOf(notification);
          if (idx !== -1) {
            setTimeout(
              () =>
                this.setState(({ notifications }) => {
                  return {
                    notifications: [
                      ...notifications.slice(0, idx),
                      ...notifications.slice(idx + 1),
                    ],
                  };
                }),
              1500
            );
          }
        };
        if (!tag || pos === -1) {
          this.setState(
            ({ notifications }) => ({
              notifications: [notification, ...notifications],
            }),
            autoClose
          );
        } else {
          // replace an existing notification with the same tag
          const notifications = this.state.notifications.map((cur, idx) =>
            idx === pos ? notification : cur
          );
          this.setState({ notifications });
        }
      },
      popNotification: () =>
        this.setState({ notifications: this.state.notifications.slice(1) }),
      // modifying functions
      updateToken: this.updateToken,
      logout: this.logout,
    };
  }

  updateToken = (incomingToken?: string): Promise<void> => {
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
