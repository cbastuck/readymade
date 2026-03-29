import { createContext, useContext, useEffect, useRef, useState } from "react";
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

function AppProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [appViewMode, setAppViewMode] = useState<AppViewMode>("wide");

  // Keep a ref to user so callbacks always access the latest value without
  // being re-created on every render.
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const pushNotification = (notification: Notification) => {
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
  };

  const popNotification = () => {};

  const onToken = (idToken: IdToken): Promise<void> => {
    return new Promise((resolve, reject) => {
      const idJwt = idToken.__raw;
      if (idJwt && idJwt !== userRef.current?.idToken) {
        try {
          const { username, userId, features, picture } = processToken(idJwt);
          setTimeout(() => {
            setUser({ username, userId, features, picture, idToken: idJwt });
            resolve();
          });
        } catch (err) {
          reject(err);
          return;
        }
      }
      resolve();
    });
  };

  const logout = async () => {
    setUser(null);
  };

  const onResize = ({ appViewMode: newMode }: OnChangeEvent) => {
    setAppViewMode((prev) => (newMode !== prev ? newMode : prev));
  };

  const onError = useRef((err: any) => {
    if (
      err.message.includes(
        "ResizeObserver loop completed with undelivered notifications"
      )
    ) {
      return;
    }
    pushNotification({ message: err.message, type: "error" });
  });

  const onUnhandledException = useRef((event: any) => {
    pushNotification({
      message: `Unhandled rejection: ${event.reason}`,
      type: "error",
    });
  });

  useEffect(() => {
    const onErr = onError.current;
    const onUnhandled = onUnhandledException.current;
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  const value: AppContextState = {
    user,
    appViewMode,
    pushNotification,
    popNotification,
    updateToken: onToken,
    logout,
  };

  return (
    <Provider value={value}>
      <ResizeObserver onChange={onResize} />
      <RestoredUser onToken={onToken} />
      {children}
    </Provider>
  );
}

export function useAppContext() {
  return useContext(AppCtx);
}

export { AppConsumer, AppCtx };
export default AppProvider;
