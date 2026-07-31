import { createContext, useContext, useEffect, useRef, useState } from "react";
import { IdToken } from "@auth0/auth0-react";
import { toast } from "sonner";

import ResizeObserver, { OnChangeEvent } from "./ResizeObserver";
import { processToken } from "./core/Auth";
import { User, Notification, AppViewMode } from "./types";
import RestoredUser from "./RestoredUser";
import RestoredPlatformUser from "./RestoredPlatformUser";
import { usePlatform } from "./platform/PlatformContext";

export type AppContextState = {
  user: User | null;
  appViewMode: AppViewMode;
  pushNotification: (n: Notification) => void;
  popNotification: () => void;
  updateToken: (incomingToken: IdToken) => Promise<void>;
  logout: () => void;
  /**
   * Resolves once every session source has settled — with the restored user, or
   * null when nobody is signed in. Sources are the Auth0 client (web) and the
   * host's own session (native login); both are asynchronous, so on a cold page
   * load `user` is briefly null even for a signed-in visitor. Anything that
   * authenticates an outbound request during startup must await this rather than
   * reading `user`, or it will send no credentials.
   */
  waitForAuthResolved: () => Promise<User | null>;
};

type Props = {
  children: JSX.Element | JSX.Element[];
};

/** Upper bound on how long a caller waits for the Auth0 session to settle. */
const AUTH_RESOLVE_TIMEOUT_MS = 5000;

const AppCtx = createContext<AppContextState>({
  user: null,
  appViewMode: "wide",
  pushNotification: (_: Notification) => {},
  popNotification: () => {},
  updateToken: async (_: IdToken) => {},
  logout: () => {},
  waitForAuthResolved: async () => null,
});
const { Provider } = AppCtx;

function AppProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [appViewMode, setAppViewMode] = useState<AppViewMode>("wide");

  // Keep a ref to user so callbacks always access the latest value without
  // being re-created on every render.
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  // Auth restore is asynchronous, so callers needing credentials at startup wait
  // on this one deferred rather than reading `user` and finding it briefly null.
  const [authResolved] = useState(() => {
    let resolve!: (user: User | null) => void;
    const promise = new Promise<User | null>((r) => {
      resolve = r;
    });
    // Reads userRef at settle time, so it always reports the user as it stands
    // when auth actually finished — not as it was when this was created.
    const settle = () => resolve(userRef.current);
    // Never block indefinitely on an auth state that fails to settle (an
    // unreachable Auth0, a host that renders no session restorer). Callers then
    // proceed unauthenticated — a visible 401 rather than a board that silently
    // never loads. Resolving twice is a no-op, so arming this unconditionally
    // is safe.
    setTimeout(settle, AUTH_RESOLVE_TIMEOUT_MS);
    return { promise, settle };
  });

  const waitForAuthResolved = () => authResolved.promise;

  // Auth can be restored from two independent places: the Auth0 client (web) and
  // the host's own session (native login). Both must settle before the state is
  // declared resolved — marking it on the first one lets a caller proceed while
  // the other is still restoring, which is exactly the unauthenticated-request
  // bug this gate exists to prevent.
  const platform = usePlatform();
  const pendingRestores = useRef(platform.restoreSession ? 2 : 1);
  const markAuthResolved = () => {
    pendingRestores.current -= 1;
    if (pendingRestores.current <= 0) {
      authResolved.settle();
    }
  };

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
      // Nothing to apply: no token, or the one we already hold.
      if (!idJwt || idJwt === userRef.current?.idToken) {
        resolve();
        return;
      }

      let restored: User;
      try {
        const { username, userId, features, picture, email } =
          processToken(idJwt);
        restored = { username, userId, features, picture, email, idToken: idJwt };
      } catch (err) {
        reject(err);
        return;
      }

      // Applying the user is deferred because this runs from RestoredUser's
      // render pass. The promise must resolve *inside* that callback: awaiting
      // onToken has to mean "the user is available", and resolving earlier
      // hands callers a context that still looks signed out.
      setTimeout(() => {
        // Set the ref alongside the state so waiters resolved from here see the
        // user before React has re-rendered.
        userRef.current = restored;
        setUser(restored);
        resolve();
      });
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
    waitForAuthResolved,
  };

  return (
    <Provider value={value}>
      <ResizeObserver onChange={onResize} />
      <RestoredUser
        onToken={onToken}
        onResolved={markAuthResolved}
        onError={(message) => pushNotification({ message, type: "error" })}
      />
      <RestoredPlatformUser
        onToken={onToken}
        onResolved={markAuthResolved}
        onError={(message) => pushNotification({ message, type: "error" })}
      />
      {children}
    </Provider>
  );
}

export function useAppContext() {
  return useContext(AppCtx);
}

export { AppCtx };
export default AppProvider;
