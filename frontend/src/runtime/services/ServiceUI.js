import React, { Component } from 'react';

import { BoardConsumer } from '../../BoardContext';

export default class ServiceUI extends Component {
  componentDidMount() {
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setup = (boardContext, { runtimeId, backendService, onTimer }) => {
    if (!this.service) {
      const runtime = boardContext && boardContext.getCurrentBrowserRuntime(runtimeId);
      const service = runtime && runtime.getServiceById(backendService.uuid);
      this.service = service;
      this.timer = setInterval(() => onTimer(service), 1000);
    }
    return this.service;
  }

  render() {
    const { children } = this.props;
    return (
     <BoardConsumer>
       {
         boardContext => children(
          { 
            boardContext,
            service: this.setup(boardContext, this.props)
          }
         )
       }
     </BoardConsumer>
   ); 
  }
}