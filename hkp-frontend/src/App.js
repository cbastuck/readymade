import React from "react";

import Routes from "./Routes";
import AppContext from "./AppContext";
import MessageDispatcher from "./MessageDispatcher";
import Notifications from "./Notifications";

import "./App.css";

export default function App() {
  return (
    <AppContext>
      <div
        style={{
          height: "100%",
          width: "100%",
          overflow: "auto",
        }}
      >
        <Routes />
        <Notifications />
      </div>

      <MessageDispatcher />
    </AppContext>
  );
}
