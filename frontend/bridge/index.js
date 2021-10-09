import "regenerator-runtime/runtime";
import React from "react";
import ReactDOM from "react-dom";
import Peerjs from "../node_modules/peerjs/dist/peerjs.js";
import Headless from "../src/views/headless";

const { host: thisHost, protocol } = window.location;
const empty = () => {};
function to(name, { host = thisHost, onPeer = empty, onData = empty }) {
  const peer = new Peerjs(name, {
    host,
    port: protocol === "https:" ? 443 : 80,
    path: "/peers",
  });

  peer.on("open", () => {
    onPeer(name, peer);
  });

  peer.on("connection", (connection) =>
    connection.on("data", (data) => onData(data, connection.peer))
  );
}

function buildRuntime(props, rootElement) {
  const root = rootElement ? rootElement : document.createElement("div");
  if (!rootElement) {
    document.body.appendChild(root);
  }
  ReactDOM.render(<Headless {...props} />, root);
}

const hookup = { to, buildRuntime };

window.hookup = hookup;

export { hookup };
