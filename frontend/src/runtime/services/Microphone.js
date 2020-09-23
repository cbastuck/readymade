import React, { Component } from 'react';
import {
  Button
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import MediaRecorder from 'audio-recorder-polyfill';

const serviceId = 'hookup.to/service/microphone';
const serviceName = 'Microphone';

class MicrophonePolyfillUI extends Component {
  state = {
    recording: false,
  };

  onTimer = service => {
    if (this.state.recording !== service.isRecording) {
      this.setState({ recording: service.isRecording });
    }
  }

  renderMain = service => {
    return (
      <div
        style={{
          margin: '0px 5px',
        }}
      >
        <canvas 
          ref={canvas => service.canvas = canvas}
          height={100}
          width={400}
        />
        <Button
          onClick={() => this.state.recording ? 
            service.stopRecorder() : 
            service.startRecorder()
          }
        >
          { this.state.recording ? 'STOP' : 'RECORD' }
        </Button>
      </div>
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onTimer={this.onTimer.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    );
  }
}

class MicrophonePolyfill {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.recorder = undefined;
    this.isRecording = false;
    this.timeslice = 1000;
    this.stream = undefined;
    this.audioCtx = undefined;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.stream = stream;
        this.visualize();
      });
  }

  configure(config) {
    const { timeslice } = config;

    if (timeslice !== undefined) {
      this.timeslice = timeslice;
    }
  }

  async startRecorder() {
    try {
      this.recorder = new MediaRecorder(this.stream);
      this.recorder.addEventListener(
        'dataavailable', 
        e => this.app.next(this, e.data)
      );
      this.recorder.start(this.timeslice);
      this.isRecording = true;
    } catch (err) {
      console.error('Microphone error', err);
    }
  }

  stopRecorder() {
    if (this.recorder) {
      this.recorder.stop();
      this.stream.getAudioTracks()[0].stop();
      this.stream = this.recorder = undefined;
      this.isRecording = false;
    }
  }

  // copied from here: https://github.com/mdn/web-dictaphone
  visualize() {
    if(!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);
    this.draw();
  }

  // copied from here: https://github.com/mdn/web-dictaphone
  draw() {
    if (!this.canvas) {
      return;
    }
    const canvasCtx = this.canvas.getContext('2d');
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = this.canvas.width
    const height = this.canvas.height;

    requestAnimationFrame(this.draw.bind(this));

    this.analyser.getByteTimeDomainData(dataArray);
  
    canvasCtx.fillStyle = 'white';
    canvasCtx.fillRect(0, 0, width, height);

    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = 'gray';

    canvasCtx.beginPath();
    const sliceWidth = width * 1.0 / bufferLength;
    for(let i = 0, x = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = v * height / 2;

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    canvasCtx.lineTo(width, height/2);
    canvasCtx.stroke();
  }

  async process(params) {
    if (!this.isRecording) {
      await this.startRecorder();
    }
    return null;    
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new MicrophonePolyfill(app, board, descriptor, id),
  createUI: MicrophonePolyfillUI
};

export default descriptor;
