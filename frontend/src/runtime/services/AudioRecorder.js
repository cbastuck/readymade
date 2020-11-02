import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';


import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

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

  onNotification = (service, notification) => {
    const { recording, rendered } = notification;
    if (this.state.recording !== recording) {
      this.setState({ recording });
    }
    if (this.state.rendered !== rendered) {
      this.setState({ rendered });
    }
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
    this.duration = 50;    
    this.offlineCtx = undefined;
    this.startTime = undefined;
  }

  configure(config) {
    const { recording } = config;
    if (recording !== undefined && this.recording !== recording) {
      if (recording) {
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

  // TODO: copied from AudioOutput
  decodeBuffer(audioContext, data) {
    return new Promise((resolve, reject) => 
      audioContext.decodeAudioData(
        data, 
        buffer => resolve(buffer),
        e => reject(e)
      )
    );
  }

  // TODO: copied from AudioOutput - looks very generic outside of audio context
  toArrayBuffer(blobOrFile) {
    if (blobOrFile.arrayBuffer) {
      return blobOrFile.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      try {
        fr.onload = () => resolve(fr.result);
        fr.readAsArrayBuffer(blobOrFile);
      } catch(err) {
        reject(err);
      }
    });
  }

  async process(params) {
    if (this.recording) {
      if (params && (params instanceof Blob || params instanceof File)) {
        const ab = await this.toArrayBuffer(params);
        const source = this.offlineCtx.createBufferSource();
        source.buffer = await this.decodeBuffer(this.offlineCtx, ab);
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