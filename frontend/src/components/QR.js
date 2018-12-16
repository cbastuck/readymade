import React, { Component } from 'react';
import QRCode from 'qrcode';

export default class QR extends Component {
  state = {
    canvas: undefined
  };

  render() {
    if (this.state.canvas) {
      const location = window.location.href.split('/');
      const url = location.slice(0, location.length - 1).join('/');
      QRCode.toCanvas(this.state.canvas, url, error => {
        if (error) {
          console.error(error);
        }
      })
    }

    return (
      <div
        style={{
          width: '50%',
          height: '50%',
          position: 'absolute',
          top: '25%',
          left: '25%',
          backgroundColor: 'white',
        }}
        onClick={this.props.onClick}
      >
        <div
          style={{
            position: 'relative',
            top: '30%',
            left: '40%'
          }}
        >
          <canvas
            ref={canvas => !this.state.canvas && this.setState({ canvas })}
            width="100%"
            height="100%"
          />
        </div>
      </div>
    );
  }
};
