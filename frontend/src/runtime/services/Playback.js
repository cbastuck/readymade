import React, { Component } from 'react';

import { BoardConsumer } from '../../BoardContext';

const serviceId = 'hookup.to/service/playback';
const serviceName = 'Playback';

class PlaybackUI extends Component {
  constructor(props) {
    super(props);
    this.audio = undefined;
    this.state = {};
  }

  encodeAsDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
          const dataurl = e.target.result;
          return resolve(dataurl.substr(dataurl.indexOf(',')+1));
      };
      reader.onerror = err => reject(err);
      reader.readAsDataURL(blob);
    });
  }

  async process(data) {
    if (data instanceof Blob) {
      const base64Blob = await this.encodeAsDataURL(data);
      const buffer = `data:${data.type};base64,${base64Blob}`;
      this.setState({ encodedBuffer: buffer });
    } else {
      console.error('Processing non-blob data in Playback service', data);
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
            <audio 
              controls 
              src={this.state.encodedBuffer}
            />
            {
              boardContext.getCurrentBrowserRuntime(this.props.runtimeId) &&
              (
                boardContext.getCurrentBrowserRuntime(this.props.runtimeId)
                  .getServiceById(this.props.service.uuid)
                  .setPlaybackFunc(this.process.bind(this))
              )
            }
          </div>
        )
      }
      </BoardConsumer>
    );
  }
}

class Playback {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
  }

  setPlaybackFunc(f) {
    this.playbackFunc = f;
  }

  async process(params) {    
    if (this.playbackFunc) {
      this.playbackFunc(params);
    }

    return this.app.next(this, params);
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Playback(app, board, descriptor, id),
  createUI: PlaybackUI
};

export default descriptor;
