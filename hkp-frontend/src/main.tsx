/*
 * Copyright © 2024 Christoph Bastuck
 * This program is licensed under the terms of the GNU Affero General Public License, version 3.0.
 * For inquiries, contact: mail@cbastuck.de
 */

/// <reference types="vite-plugin-svgr/client" />

// import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

import Routes from "./Routes";

import "setimmediate";

/**
 * The Auth0 application this app signs users in through: the SPA-type one, as
 * for any host that runs the login in a browser. The native apps name their own
 * (Native-type) application where they mount the shell — see AuthProvider for
 * why one registration cannot serve both.
 */
const AUTH0_CLIENT_ID = "x4iF0MBYfd25oLdJbATNe03dCDUtBs74";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App clientId={AUTH0_CLIENT_ID}>
    <Routes />
  </App>
);
