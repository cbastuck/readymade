import "../src/index.css";
import "../app/globals.css";
import "./lib.css";

import App from "../src/App";
import About from "../src/views/about/About";
import Playground from "../src/views/playground";
import AppProvider, { AppContextState, AppCtx } from "../src/AppContext";
import AuthProvider from "../src/auth/Auth0Provider";
import Notifications from "../src/Notifications";
import { useContext } from "react";

export function useAppContext() {
  return useContext<AppContextState>(AppCtx);
}

export {
  App,
  Playground,
  AppProvider,
  AppCtx,
  About,
  AuthProvider,
  Notifications,
};
