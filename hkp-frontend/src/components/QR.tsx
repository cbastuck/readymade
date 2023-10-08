import { Component } from "react";

import QRCode from "qrcode";

type Props = {
  url: string;
};

type State = {
  canvas: null | HTMLCanvasElement;
};

export default class QR extends Component<Props, State> {
  state = {
    canvas: null,
  };

  setCanvas = (canvas: null | HTMLCanvasElement) => {
    if (!this.state.canvas) {
      this.setState({ canvas });
    }
  };

  render() {
    const { url = window.location.href } = this.props;
    const { canvas } = this.state;

    if (canvas) {
      QRCode.toCanvas(canvas, url, (error: Error | null | undefined) => {
        if (error) {
          console.error("QR.toCanvas()", error);
        }
      });
    }

    return <canvas ref={this.setCanvas} width="100%" height="100%" />;
  }
}
