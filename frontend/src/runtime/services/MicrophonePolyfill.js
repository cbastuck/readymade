import React, { Component } from 'react';
import {
  Button
} from 'semantic-ui-react';

import { BoardConsumer } from '../../BoardContext';
import MediaRecorder from 'audio-recorder-polyfill';

const serviceId = 'hookup.to/service/microphone-poly';
const serviceName = 'Microphone Poly';

class MicrophonePolyfillUI extends Component {
  constructor(props) {
    super(props);
    this.recorder = undefined;
    this.state = {
      recording: false
    }
  }

  async startRecorder(boardContext) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    this.gumStream = stream;
    this.recorder = new MediaRecorder(stream);
    this.recorder.addEventListener('dataavailable', e => {
      // send the data to the service
      const runtime = boardContext.getCurrentBrowserRuntime(this.props.runtimeId);
      if (runtime) {
        const service = runtime.getServiceById(this.props.service.uuid)
        service && service.process({ blob: e.data });
      }
    });
    this.recorder.start();
    this.setState({ recording: true });
  }

  stopRecorder() {
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.stop();
      this.gumStream.getAudioTracks()[0].stop();
      this.gumStream = this.recorder = undefined;
      this.setState({ recording: false });
    }
  }

  render() {
    return (
      <BoardConsumer>
      {
        boardContext => (
          <div
            style={{
              margin: 10
            }}
          >
            <Button
              onClick={() =>
                this.state.recording ? 
                  this.stopRecorder() : 
                  this.startRecorder(boardContext)
              }
            >
              { this.state.recording ? 'STOP' : 'RECORD' }
            </Button>
          </div>
        )
      }
      </BoardConsumer>
    );
  }
}

class MicrophonePolyfill {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
  }

  async process(params) {
    const { blob } = params;
    return this.app.next(this, blob);
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
