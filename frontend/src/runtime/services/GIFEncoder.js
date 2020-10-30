import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import GIF from 'gif.js'

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/gif-encoder';
const serviceName = 'GIF Encoder';

class GIFEncoderUI extends Component {
  state = {
    gifData: undefined,
    state: 'stopped',
  };

  componentWillUnmount() {
    const { gifData } = this.state;
    if (gifData) {
      URL.revokeObjectURL(gifData);
    }
  }

  render() {
    const { gifData, state } = this.state;
    return (
      <ServiceUI 
        {...this.props}
      >
        { 
          ({ service }) => (
            <div>
              <div>
                { 
                  gifData ? (
                    <img 
                      alt="animated gif"
                      src={gifData}
                    />
                  ) : (
                    <div style={{ height: 200, width: 300 }}>
                      { state === 'stopped' && 'No Recording available' }
                      { state === 'rendering' && 'Rendering recording' }
                      { state === 'recording' && 'Recording in progress' }
                    </div>
                  )
                }
              </div>
              <Button
                style={s(t.m(10), t.uc, t.ls1, t.fs12)}
                disabled={state === 'rendering'}
                onClick={async () => {
                  if (state === 'stopped') {
                    service.configure({ recording: true });
                    this.setState({ 
                      gifData: undefined, 
                      state: 'recording', 
                    });
                  } else if (state === 'recording') {
                    this.setState({ state: 'rendering' });
                    const { gifData } = this.state;
                    if (gifData) {
                      URL.revokeObjectURL(gifData);
                    }
                    const blob = await service.renderAnimatedGIF();
                    const url = URL.createObjectURL(blob);
                    this.setState({ 
                      gifData: url, 
                      state: 'stopped' 
                    });
                    service.configure({ recording: false });
                  }
                }}
              >
                { state === 'recording' ? 'Stop' : 'Record' }
              </Button>
              </div>
          )
        }
      </ServiceUI>
    );
  }
}

class GIFEncoder {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.images = [];
    this.recording = false;
  }

  configure(config) {
    const { recording } = config;

    if (recording !== undefined) {
      this.recording = recording;
    }
  }

  renderAnimatedGIF = () => {
    return new Promise(resolve => {
      this.gif.on('finished', blob => {
        resolve(blob);
        this.gif = undefined;
      });
      this.gif.render();
    });
  }

  blobToImage = blob => {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      }
      img.src = url;
    });
  }

  async process(params) {
    if (this.recording) {
      const image = await this.blobToImage(params);
      if (!this.gif) {
        this.gif = new GIF({
          workers: 2,
          quality: 10,
          workerScript: 'res/gif.js/gif.worker.js'
        });
      }
      this.gif.addFrame(image, { delay: 1 });
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new GIFEncoder(app, board, descriptor, id),
  createUI: GIFEncoderUI
};

export default descriptor;
