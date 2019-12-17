import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/remote-window';
const serviceName = 'RemoteWindow';

class RemoteWindowUI extends Component {
  componentDidMount() {
    this.setState(
      { window: window.open(undefined, 'remote', undefined, true) }
    );
  }

  update = () => {
    const wdw = this.state.window;
    const doc = wdw.document;
    if (!doc.title) {
      doc.title = 'Hookup Remote';  
    }
    
    wdw.document.body.appendChild(
      doc.createTextNode('Hello Remote Window')
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props}
        onInit={service => 
          this.setState({ fullscreen: service.fullscreen })
        }
      >
      {
        ({ service }) => (
          service && service.register(this.update) && (
            <div />
          )
        )
      }
      </ServiceUI>
    );
  }
}

class RemoteWindow {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  register(callback) {
    this.callback = callback;
    return true;
  }

  configure(config) {
  }

  process(params) {
    if (this.callback) {
      this.callback(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new RemoteWindow(app, board, descriptor, id),
  createUI: RemoteWindowUI
};

export default descriptor;