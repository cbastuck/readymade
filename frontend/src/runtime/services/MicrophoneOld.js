import React, { Component } from 'react';
import {
  Button
} from 'semantic-ui-react';

import { BoardConsumer } from '../../BoardContext';

const serviceId = 'hookup.to/service/microphone';
const serviceName = 'Microphone';

class MicrophoneUI extends Component {
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
    this.recorder.start();
    this.recorder.ondataavailable = (e) => {
      // send the data to the service
      const runtime = boardContext.getCurrentBrowserRuntime(this.props.runtimeId);
      if (runtime) {
        const service = runtime.getServiceById(this.props.service.uuid)
        service && service.process({ blob: e.data });
      }
    }
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

class Microphone {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
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
    new Microphone(app, board, descriptor, id),
  createUI: MicrophoneUI
};

export default descriptor;
