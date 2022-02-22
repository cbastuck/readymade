import React from "react";

import Routes from "./Routes";
import AppContext from "./AppContext";
import MessageDispatcher from "./MessageDispatcher";

import "./App.css";

export default function App() {
  return (
    <AppContext>
      <div
        style={{
          height: "100%",
          width: "100%",
          overflow: "auto", // without this on iOS/responsive decvices they height corresponds the screen height, not the page height, so limit the height of the page to 100%
        }}
      >
        <Routes />
      </div>

      <MessageDispatcher />
    </AppContext>
  );
}
