import { Component } from 'react';

export default class MessageReceiver extends Component {
  static redirects = {};

  static registerRedirect(state, callback) {
    MessageReceiver.redirects[state] = callback;
  }

  componentDidMount() {
    const onMsgReceived = ev => {
      const data = ev.data && JSON.parse(ev.data);
      if (data.state) {
        const callback = MessageReceiver.redirects[data.state];
        if (callback) {
          callback(data);
        }
      }
    };
    window.addEventListener('message', onMsgReceived, false);
  }

  render() {
    return false;
  }
}