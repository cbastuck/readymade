import { Component, createContext } from "react";
import { IdToken } from "@auth0/auth0-react";

import { processToken } from "./core/Auth";
import { User, Notification } from "./types";
import RestoredUser from "./RestoredUser";

export type AppContextState = {
  user: User | null;
  notifications: Array<Notification>;
  pushNotification: (n: Notification) => void;
  popNotification: () => void;
  updateToken: (incomingToken: IdToken) => Promise<void>;
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

    this.state = {
      // state members
      user: null,
      notifications: [],
      pushNotification: (notification) => {
        const { tag, timeout = 1500 } = notification;
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
              timeout
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

  updateToken = (idToken: IdToken): Promise<void> => {
    return new Promise((resolve, reject) => {
      const idJwt = idToken.__raw;
      if (idJwt && idJwt !== this.state.user?.idToken) {
        try {
          const { username, userId, features, picture } = processToken(idJwt);
          setTimeout(() =>
            this.setState(
              {
                user: { username, userId, features, picture, idToken: idJwt },
              },
              resolve
            )
          );
        } catch (err) {
          reject(err);
          return;
        }
      }
      resolve();
    });
  };

  logout = async () => {
    this.setState({ user: null });
  };

  render() {
    const { children } = this.props;
    return (
      <Provider
        value={{
          ...this.state,
        }}
      >
        <RestoredUser onToken={this.updateToken} />
        {children}
      </Provider>
    );
  }
}

export { AppConsumer, AppCtx };
export default AppContext;
