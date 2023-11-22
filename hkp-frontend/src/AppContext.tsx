import { Component, createContext } from "react";

import { processToken } from "./core/Auth";
import { User, Notification } from "./types";
import RestoredUser from "./RestoredUser";

export type AppContextState = {
  user: User | null;
  notifications: Array<Notification>;
  pushNotification: (n: Notification) => void;
  popNotification: () => void;
  updateToken: (incomingToken: string, claims?: any) => void;
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

  updateToken = (idJwt?: string): Promise<void> => {
    return new Promise((resolve) => {
      if (idJwt && idJwt !== this.state.user?.idToken) {
        const { username, userId, features } = processToken(idJwt);
        setTimeout(() =>
          this.setState(
            {
              user: { username, userId, features, idToken: idJwt },
            },
            resolve
          )
        );
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
        <RestoredUser onToken={({ __raw: jwt }) => this.updateToken(jwt)} />
        {children}
      </Provider>
    );
  }
}

export { AppConsumer, AppCtx };
export default AppContext;
