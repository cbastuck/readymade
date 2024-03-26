import React, { Component } from "react";

import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/remote-window";
const serviceName = "RemoteWindow";

/*
function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
*/

class RemoteWindowUI extends Component {
  componentDidMount() {
    this.setState({
      window: window.open(undefined, "remote", undefined, true),
    });
  }

  update = (value) => {
    const wdw = this.state.window;
    const doc = wdw.document;
    if (!doc.title) {
      doc.title = "Hookup Remote";
    }

    /*
    doc.body.appendChild(
      doc.createTextNode('Hello Remote Window')
    );
    */

    //doc.body.style.backgroundColor = getRandomColor();

    if (!value.bot) {
      doc.body.appendChild(
        doc.createElement("h1").appendChild(doc.createTextNode(value.user))
          .parentNode
      );
      const link = doc
        .createElement("a")
        .appendChild(doc.createTextNode(value.meta.uri)).parentNode;
      link.setAttribute("href", value.meta.uri);
      link.setAttribute("target", "_blank");
      doc.body.appendChild(link);
    }
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={(service) => this.setState({ fullscreen: service.fullscreen })}
      >
        {({ service }) => service && service.register(this.update) && <div />}
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

  configure(config) {}

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
  createUI: RemoteWindowUI,
};

export default descriptor;
