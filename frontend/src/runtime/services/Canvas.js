import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/canvas';
const serviceName = 'Canvas';

const TWO_PI = 2 * Math.PI;

function toAbsolute(value, upper) {
  if (value === undefined || upper === undefined) {
    return 0;
  }
  if (typeof value === 'string') {
    const components = value.split('%');
    if (components.length > 1) {
      return Number(components[0]) / 100 * upper;
    }
  }
  return value;
}

class CanvasUI extends Component {
  state = {
    fullWidth: document.body.clientWidth,
    fullHeight: document.body.clientHeight,
    fullscreen: false
  };

  componentDidMount() {
    document.body.onresize = ev => {
      this.setState(
        {
          fullWidth: document.body.clientWidth,
          fullHeight: document.body.clientHeight
        },
        () => this.update(this.recentData || {})
      );
    };
  }

  getCanvasDim = () => {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  getCanvasCenter = () => {
    const { width, height } = this.getCanvasDim();
    const centerX = width / 2;
    const centerY = height / 2;
    return { 
      centerX, 
      centerY, 
      canvasWidth: width, 
      canvasHeight: height 
    };
  }

  drawImage = (ctx, data) => {
    const { url, offsetX, offsetY, opacity} = data; 
    const img = new Image();
    img.onload = () => {
      const { centerX, centerY, canvasHeight } = this.getCanvasCenter();
      const aspectRatio = img.width / img.height;
      const scaledWidth = canvasHeight * aspectRatio;
      const imgCentX = offsetX ? offsetX : (centerX - scaledWidth / 2);
      const imgCentY = offsetY ? offsetY : (centerY - img.height / 2);

      ctx.save();
      if (opacity !== undefined) {
        ctx.globalAlpha = opacity;
      }
      ctx.drawImage(
        img, 
        imgCentX,
        imgCentY,
        scaledWidth,
        canvasHeight
      );
      ctx.restore();
    }
    img.src = url;
  }

  drawText = (ctx, data) => {
    const { centerX, centerY, canvasWidth, canvasHeight } = this.getCanvasCenter();
    ctx.fillStyle = data.color || "#000";

    ctx.save();
    ctx.font = data.font || "30px Arial";
    const width = ctx.measureText(data.text).width;
    const x = data.x === undefined ? centerX : toAbsolute(data.x, canvasWidth);
    const y = data.y === undefined ? centerY : toAbsolute(data.y, canvasHeight);
    ctx.fillText(data.text, x - width / 2, y);
    if (data.contour) {
      ctx.strokeStyle = data.contour.color;
      ctx.lineWidth = data.contour.lineWidth || 1;
      ctx.strokeText(data.text, centerX - width / 2, centerY);
    }
    ctx.restore();
  }

  drawCircle = (ctx, data) => {
    const { width, height } = this.getCanvasDim();
    const { radius=100, color, contour } = data || {};
    
    ctx.save();
    const drawPath = ctx => {
      ctx.beginPath();
      ctx.arc(
        toAbsolute(data.x, width), 
        toAbsolute(data.y, height), 
        toAbsolute(radius, height), 
        0, 
        TWO_PI
      );
    }

    if (contour) {
      ctx.strokeStyle = contour.color;
      ctx.lineWidth = contour.lineWidth || 1;
      drawPath(ctx);
      ctx.stroke();
    }

    if (color) {
      ctx.fillStyle = color;
      drawPath(ctx);
      ctx.fill();
    }
    ctx.restore();
  }

  drawRect = (ctx, data) => {
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasDim();
    const { x, y, length, width=length, height=length, color, contour } = data || {};
    
    ctx.save();
    const drawPath = ctx => {
      ctx.beginPath();
      ctx.rect(
        toAbsolute(x, canvasWidth) , 
        toAbsolute(y, canvasHeight), 
        toAbsolute(width, canvasWidth), 
        toAbsolute(height, length !== undefined ? canvasWidth : canvasHeight)
      );
    }

    if (contour) {
      ctx.strokeStyle = contour.color;
      ctx.lineWidth = contour.lineWidth || 1;
      drawPath(ctx);
      ctx.stroke();
    }

    if (color) {
      ctx.fillStyle = color;
      drawPath(ctx);
      ctx.fill();
    }

    ctx.restore();
  }

  update = objectOrArray => {
    this.recentData = objectOrArray;
    if (!this.canvas || !objectOrArray) {
      // nothing to render, or nowhere to render to
      return;
    }

    const dataArray = Array.isArray(objectOrArray) ? objectOrArray : [objectOrArray];
    const ctx = this.canvas.getContext("2d");
    ctx.fillStyle = "#FFF";
    ctx.strokeStyle = "#FFF";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const data of dataArray) {
      switch (data.type) {
        case 'image':
          this.drawImage(ctx, data);
          break;
        case 'text':
          this.drawText(ctx, data);
          break;
        case 'circle':
          this.drawCircle(ctx, data);
          break;
        case 'rect':
        case 'square':
          this.drawRect(ctx, data);
          break;
        default:
          break;
      }
    }
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
            <canvas 
              ref={canvas => this.canvas = canvas} 
              style={{
                position: (this.state.fullscreen || service.fullscreen) && 'fixed',
                top: 0,
                left: 0
              }}
              width={(this.state.fullscreen || service.fullscreen) ? this.state.fullWidth : 300}
              height={(this.state.fullscreen || service.fullscreen) ? this.state.fullHeight : 150}
              onDoubleClick={() => {
                const toggled = !this.state.fullscreen;
                service.fullscreen = toggled;
                this.setState({ fullscreen: toggled });
              }}
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
