import { Component } from "react";

import MessageDispatcher from "./MessageDispatcher";

export default class MessageReceiver extends Component {
  componentDidMount() {
    const { state, onData } = this.props;
    MessageDispatcher.registerRedirect(state, onData);
  }

  componentWillUnmount() {
    const { state } = this.props;
    MessageDispatcher.unregisterRedirect(state);
  }

  render() {
    return false;
  }
}
