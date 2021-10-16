import "regenerator-runtime/runtime";
import React from "react";
import ReactDOM from "react-dom";
import Headless from "../src/views/headless";
import Peerjs from "../node_modules/peerjs/dist/peerjs.js";

import { Observable } from "rxjs";

import "semantic-ui-css/semantic.min.css";

const { host: thisHost, protocol } = window.location;

const emptyFunc = () => {};

function to(name, { host = thisHost, onPeer = emptyFunc, onData = emptyFunc }) {
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
    // root.style = "height: 100%";
    document.body.appendChild(root);
  }

  let subscribers = [];
  const onDataCallback = (data) => {
    for (const sub of subscribers) {
      sub.next(data);
    }
  };
  let headless;
  const Comp = (
    <Headless
      {...props}
      ref={(h) => (headless = h)}
      callback={onDataCallback}
    />
  );
  ReactDOM.render(Comp, root);

  const obs = new Observable((subscriber) => {
    subscribers.push(subscriber);
  });
  const subscribe = (callbacks) => {
    const subscription = obs.subscribe(callbacks);
    const theSubscriber = subscribers[subscribers.length - 1];
    return {
      unsubscribe: () => {
        subscribers = subscribers.filter((s) => s !== theSubscriber);
        subscription.unsubscribe();
      },
    };
  };

  const configure = (serviceId, config) =>
    headless.configure(serviceId, config);

  const process = (serviceId, params) => headless.process(serviceId, params);

  return { root, subscribe, configure, process };
}

const hookup = { to, buildRuntime };

window.hookup = hookup;
export { hookup };
