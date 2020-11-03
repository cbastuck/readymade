import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import ServiceUI from '../ServiceUI';
import { decodeBuffer, combineChannels } from './audioHelper';
import { toArrayBuffer } from '../helpers';

import { s, t } from '../../../styles';

const serviceId = 'hookup.to/service/audio-recorder';
const serviceName = 'Audio Recorder';

class AudioRecorderUI extends Component {
  state = {
    recording: false,
    rendered: false
  };

  onInit = service => {
    const { recording } = service;
    this.setState({ 
      recording,
      rendered: service.renderedBuffer,
    });
  }

  onNotification = async (service, notification) => {
    const { recording, rendered } = notification;
    if (this.state.recording !== recording) {
      this.setState({ recording });
    }

    if (this.state.rendered !== rendered) {
      if (rendered) {
        this.renderBuffer(service.renderedBuffer);
      }
      this.setState({ rendered });
    }
  }

  renderBuffer = buffer => {
    const WIDTH = this.canvas.width;
    const HEIGHT = this.canvas.height;
    this.canvasCtx.fillStyle = 'white';
    this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    this.canvasCtx.lineWidth = 1;
    this.canvasCtx.strokeStyle = 'gray';
    this.canvasCtx.beginPath();

    const dataArray = buffer.numberOfChannels > 1 ? combineChannels(buffer) : buffer.getChannelData(0);
    const bufferLength = dataArray.length;
    const sliceWidth = bufferLength / WIDTH;
    const halfHeight = HEIGHT / 2;
    for (let x = 0; x < WIDTH; ++x) {
      const idx = x * sliceWidth;
      const v = dataArray
        .slice(idx, idx+sliceWidth)
        .reduce((sum, c) => sum + c, 0);
      const y = v * halfHeight + halfHeight;
      if (x === 0) {
        this.canvasCtx.moveTo(x, y);
      } else {
        this.canvasCtx.lineTo(x, y);
      }
    }

    this.canvasCtx.lineTo(WIDTH, halfHeight);
    this.canvasCtx.stroke();
  }

  renderMain = service => {
    const { recording, rendered } = this.state;
    return (
      <div style={s(t.fill)}>
        <Button
          style={s(t.uc, t.ls1, t.fs12, t.m(2))}
          onClick={() => {
            recording ? 
              service.doRender() : 
              service.configure({ recording: true })
          }}
        >
          {
            recording ? 'Stop Record' : 'Start Recording'
          }
        </Button>
        <canvas 
          ref={canvas => {
            if (canvas && !this.canvas) {
              this.canvas = canvas;
              this.canvasCtx = canvas.getContext('2d');
            }
          }}
          style={{ height: 200, width: 300 }}
        />
        <Button
          style={s(t.uc, t.ls1, t.fs12, t.m(2))}
          onClick={service.injectRecording}
          disabled={!rendered}
        >
          Play Recording
        </Button>
      </div>
    );
  }
  
  render() {
    return (
      <ServiceUI 
        { ...this.props }
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    );
  }
}

class AudioRecorder {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.recording = false;
    this.sampleRate = 44100;
    this.duration = 5;    
    this.offlineCtx = undefined;
    this.startTime = undefined;
  }

  configure(config) {
    const { recording } = config;
    if (recording !== undefined && this.recording !== recording) {
      if (recording) {
        const OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        this.offlineCtx = new OfflineAudioContext(2, this.sampleRate*this.duration, this.sampleRate);
        this.startTime = undefined;
      }
      this.recording = recording;
      this.app.notify(this, { recording });
    }
  }

  doRender = async () => {
    if (this.offlineCtx) {
      this.configure({ recording: false });
      this.renderedBuffer = await this.offlineCtx.startRendering();
      this.app.notify(this, { rendered: true });
      this.offlineCtx = null;
    }
  }

  injectRecording = () => {
    if (this.renderedBuffer) {
      // TODO: should we encode it as Blob to have a common format?
      this.app.next(this, this.renderedBuffer);
    }
  }

  async process(params) {
    if (this.recording) {
      if (params && (params instanceof Blob || params instanceof File)) {
        const ab = await toArrayBuffer(params);
        const source = this.offlineCtx.createBufferSource();
        source.buffer = await decodeBuffer(this.offlineCtx, ab);
        source.connect(this.offlineCtx.destination);

        const now = Date.now() / 1000;
        const pos = this.startTime ? (now - this.startTime) : 0;
        if (!this.startTime) {
          this.startTime = now;
        }
        source.start(pos);
      }
    }
    
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new AudioRecorder(app, board, descriptor, id),
  createUI: AudioRecorderUI
};

export default descriptor;