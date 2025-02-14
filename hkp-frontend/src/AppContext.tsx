import { Component, createContext } from "react";
import { IdToken } from "@auth0/auth0-react";
import { toast } from "sonner";

import ResizeObserver, { OnChangeEvent } from "./ResizeObserver";
import { processToken } from "./core/Auth";
import { User, Notification, AppViewMode } from "./types";
import RestoredUser from "./RestoredUser";

export type AppContextState = {
  user: User | null;
  appViewMode: AppViewMode;
  pushNotification: (n: Notification) => void;
  popNotification: () => void;
  updateToken: (incomingToken: IdToken) => Promise<void>;
  logout: () => void;
};

type Props = {
  children: JSX.Element | JSX.Element[];
};

const AppCtx = createContext<AppContextState>({
  user: null,
  appViewMode: "wide",
  pushNotification: (_: Notification) => {},
  popNotification: () => {},
  updateToken: async (_: IdToken) => {},
  logout: () => {},
});
const { Provider, Consumer: AppConsumer } = AppCtx;

class AppProvider extends Component<Props, AppContextState> {
  constructor(props: Props) {
    super(props);

    this.state = {
      // state members
      user: null,
      appViewMode: "wide",

      pushNotification: (notification) => {
        const action = notification.action
          ? {
              label: notification.action.label,
              onClick: notification.action.callback,
            }
          : undefined;

        const description = "";
        const toastFunc =
          notification.type === "info"
            ? toast.info
            : notification.type === "success"
            ? toast.success
            : toast.error;
        toastFunc(notification.message, {
          description,
          action,
        });
      },
      popNotification: () => {},
      // modifying functions
      updateToken: this.onToken,
      logout: this.logout,
    };
  }

  componentDidMount(): void {
    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.onUnhandledException);
  }

  componentWillUnmount(): void {
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onUnhandledException);
  }

  onError = (err: any) => {
    // event.preventDefault(); // This will not print the error in the console });
    if (
      err.message.includes(
        "ResizeObserver loop completed with undelivered notifications"
      )
    ) {
      return; // don't show this error
    }
    this.state.pushNotification({ message: err.message, type: "error" });
  };

  onUnhandledException = (event: any) => {
    //event.preventDefault(); // This will not print the error in the console });
    this.state.pushNotification({
      message: `Unhandled rejection: ${event.reason}`,
      type: "error",
    });
  };

  onToken = (idToken: IdToken): Promise<void> => {
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

  onResize = ({ appViewMode }: OnChangeEvent) => {
    if (appViewMode !== this.state.appViewMode) {
      this.setState({ appViewMode });
    }
  };

  render() {
    const { children } = this.props;
    return (
      <Provider
        value={{
          ...this.state,
        }}
      >
        <ResizeObserver onChange={this.onResize} />
        <RestoredUser onToken={this.onToken} />
        {children}
      </Provider>
    );
  }
}

export { AppConsumer, AppCtx };
export default AppProvider;
