import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/canvas';
const serviceName = 'Canvas';

class CanvasUI extends Component {
  update = data => {
    const s = JSON.stringify(data);
    if (this.canvas) {
      const ctx = this.canvas.getContext("2d");
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.font = "30px Arial";
      if (data.type === 'text/uri-list') {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = data.data
      } else {
        ctx.fillText(s, 10, 50);
      }
    }
  }

  render() {
    return (
      <ServiceUI {...this.props}>
      {
        ({ service }) => (
          service && service.register(this.update) && (
            <canvas ref={canvas => this.canvas = canvas} />
          )
        )
      }
      </ServiceUI>
    );
  }
}

class Canvas {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  register(callback) {
    this.callback = callback;
    return true;
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
    new Canvas(app, board, descriptor, id),
  createUI: CanvasUI
};

export default descriptor;
