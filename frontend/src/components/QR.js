import React, { Component } from 'react';
import QRCode from 'qrcode';

export default class QR extends Component {
  state = {
    canvas: null,
  };

  setCanvas = canvas => {
    if (!this.state.canvas) {
      this.setState({ canvas });
    }
  }

  render() {
    const { 
      url=window.location.href,
    } = this.props;
    const { canvas } = this.state;

    if (canvas) {
      QRCode.toCanvas(canvas, url, error => {
        if (error) {
          console.error(error);
        }
      })
    }

    return (
      <canvas
        ref={this.setCanvas}
        width="100%"
        height="100%"
      />
    );
  }
};
