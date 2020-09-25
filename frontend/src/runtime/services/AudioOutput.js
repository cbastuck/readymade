import React, { Component } from 'react';
import {
  Button,
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/audio-output'; // TODO: change to audio-input
const serviceName = 'Audio Output';

class AudioOutputUI extends Component {
  state = {
  };

  renderMain = service => {
    return (
      <div
        style={{
          margin: '0px 5px',
          textAlign: 'left'
        }}
      >
        <canvas 
          ref={canvas => {
            if (canvas) {
              service.canvas = canvas;
              service.canvasCtx = canvas.getContext('2d');
              service.visualize();
            }
          }}
        />
      </div>
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        segments={[
          { name: 'Main', render: this.renderMain }
        ]}
      />
    );
  }
}

class AudioOutput {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.connect(this.audioCtx.destination);
  }

  async configure(config) {
  }

  // taken from here: https://github.com/mdn/voice-change-o-matic
  visualize() {
    if (!this.canvas) {
      return;
    }
    const WIDTH = this.canvas.width;
    const HEIGHT = this.canvas.height;

    this.analyser.fftSize = 256;
    const bufferLengthAlt = this.analyser.frequencyBinCount;
    const dataArrayAlt = new Uint8Array(bufferLengthAlt);

    this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    const drawAlt = () => {
        this.analyser.getByteFrequencyData(dataArrayAlt);

        this.canvasCtx.fillStyle = 'white';
        this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLengthAlt) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < bufferLengthAlt; i++) {
          barHeight = dataArrayAlt[i];

          this.canvasCtx.fillStyle = `rgb(65, 131, ${barHeight+150})`;
          this.canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);

          x += barWidth + 1;
        }
        requestAnimationFrame(drawAlt);
      };

      drawAlt();
  }

  decodeBuffer(data) {
    return new Promise((resolve, reject) => 
      this.audioCtx.decodeAudioData(
        data, 
        buffer => resolve(buffer),
        e => reject(e)
      )
    );
  }

  async process(params) {
    if (params && params instanceof Blob) {     
      const ab = await params.arrayBuffer();
      const source = this.audioCtx.createBufferSource();
      source.buffer = await this.decodeBuffer(ab);
      source.connect(this.analyser);
      source.onended = () => source.disconnect();
      source.start();
    }
    return params;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new AudioOutput(app, board, descriptor, id),
  createUI: AudioOutputUI
};

export default descriptor;
