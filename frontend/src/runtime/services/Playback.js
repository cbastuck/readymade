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

  encodeBlob(blob) {
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

  encodeBuffer(buf) {
    const binstr = Array.prototype.map.call(buf, ch => 
        String.fromCharCode(ch)
    ).join('');
    return btoa(binstr);
}

  async process(data) {
    if (data instanceof Blob) {
      const base64Data = await this.encodeBlob(data);
      const buffer = `data:${data.type};base64,${base64Data}`;
      this.setState({ encodedBuffer: buffer });
    } else if (data.type === 'Buffer' && data.data) {
      // TODO: hardcoded to mime-type: audio/webm
      const base64Data = await this.encodeBuffer(data.data);
      const buffer = `data:audio/webm;base64,${base64Data}`;
      this.setState({ encodedBuffer: buffer });
    }
    else {
      console.error('Processing non-blob data in Playback service', data, typeof data, typeof data.data);
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
