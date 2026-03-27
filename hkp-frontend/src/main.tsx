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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App>
    <Routes />
  </App>
);
