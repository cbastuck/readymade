/// <reference types="vite-plugin-svgr/client" />

// import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";

import App from "./App.tsx";

import "./index.css";
import "semantic-ui-css/semantic.min.css";
import "../app/globals.css";

import "setimmediate";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Router>
    <App />
  </Router>
);
