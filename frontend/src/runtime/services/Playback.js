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

  process(data) {
    const buffer = `data:audio/ogg;base64,${data}`;
    console.log('Processing', buffer);
    this.setState({ encodedBuffer: buffer });
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
              boardContext.getCurrentBrowserRuntime() &&
              (
                boardContext.getCurrentBrowserRuntime()
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
