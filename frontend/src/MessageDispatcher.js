import { Component } from "react";

export default class MessageDispatcher extends Component {
  static redirects = {};

  static registerRedirect(state, callback) {
    MessageDispatcher.redirects[state] = callback;
  }

  static unregisterRedirect(state) {
    delete MessageDispatcher.redirects[state];
  }

  componentDidMount() {
    const onMsgReceived = (ev) => {
      try {
        const data =
          ev.data && typeof ev.data === "string" && JSON.parse(ev.data);
        if (data.state) {
          const callback = MessageDispatcher.redirects[data.state];
          if (callback) {
            callback(data);
          } else {
            console.warn(`Received message with unknown state: ${data.state}`);
          }
        }
      } catch (err) {
        // console.log(`MessageDispatcher: string message is not a valid JSON: ${ev.data}`)
      }
    };
    window.addEventListener("message", onMsgReceived, false);
  }

  render() {
    return false;
  }
}
