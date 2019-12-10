import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/canvas';
const serviceName = 'Canvas';

class CanvasUI extends Component {
  state = {
    fullWidth: document.body.clientWidth,
    fullHeight: document.body.clientHeight
  };

  componentDidMount() {
    document.body.onresize = ev => {
      this.setState({
        fullWidth: document.body.clientWidth,
        fullHeight: document.body.clientHeight
      })
    };
  }

  update = data => {
    const s = JSON.stringify(data);
    if (this.canvas) {
      const ctx = this.canvas.getContext("2d");
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.font = "30px Arial";
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      if (data.type === 'text/uri-list') {
        const img = new Image();
        img.onload = () => ctx.drawImage(
            img, 
            centerX - img.width / 2 , 
            centerY - img.height / 2
          );
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
            <canvas 
              ref={canvas => this.canvas = canvas} 
              style={{
                position: service.fullscreen && 'fixed',
                top: 0,
                left: 0
              }}
              width={service.fullscreen ? this.state.fullWidth : 300}
              height={service.fullscreen ? this.state.fullHeight : 150}
            />
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
    
    this.fullscreen = false;
  }

  register(callback) {
    this.callback = callback;
    return true;
  }

  configure(config) {
    if (config.fullscreen !== undefined) {
      this.fullscreen = config.fullscreen;
    }
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
