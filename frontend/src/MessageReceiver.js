import { Component } from 'react';

export default class MessageReceiver extends Component {
  static redirects = {};

  static registerRedirect(state, callback) {
    MessageReceiver.redirects[state] = callback;
  }

  componentDidMount() {
    const onMsgReceived = ev => {
      try{ 
        const data = ev.data && typeof ev.data === 'string' && JSON.parse(ev.data);
        if (data.state) {
          const callback = MessageReceiver.redirects[data.state];
          if (callback) {
            callback(data);
          }
        }
      } catch (err) {
        console.log(`MessageReceiver: string message is not a valid JSON: ${ev.data}`)
      }
    };
    window.addEventListener('message', onMsgReceived, false);
  }

  render() {
    return false;
  }
}