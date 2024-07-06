import "../src/index.css";
import "../app/globals.css";

import About from "../src/views/about/About";
import Playground from "../src/views/playground";
import AppProvider, { AppContextState, AppCtx } from "../src/AppContext";
import AuthProvider from "../src/auth/Auth0Provider";
import Notifications from "../src/Notifications";
import { useContext } from "react";

export function useAppContext() {
  return useContext<AppContextState>(AppCtx);
}

export { Playground, AppProvider, AppCtx, About, AuthProvider, Notifications };
