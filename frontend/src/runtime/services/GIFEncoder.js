import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import GIF from 'gif.js'

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/gif-encoder';
const serviceName = 'GIF Encoder';

class GIFEncoderUI extends Component {
  state = {
    state: 'stopped',
  };

  componentWillUnmount() {
    const { gifData } = this.state;
    if (gifData) {
      URL.revokeObjectURL(gifData);
    }
  }

  setImage = imageUrl => {
    if (!this.image) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.image.onload = resolve;
      this.image.src = imageUrl;
    });
  }

  render() {
    const { state } = this.state;
    return (
      <ServiceUI 
        { ...this.props }
        onNotification={(service, notification) => {
          const {imageUrl } = notification;
          if (imageUrl !== undefined) {
            return this.setImage(imageUrl);
          }
        }}
      >
        { 
          ({ service }) => (
            <div>
              <div>
                <img
                  ref={image => this.image = image}
                  alt="animated gif"
                  src="/assets/white.png"
                />
              </div>
              <Button
                style={s(t.m(10), t.uc, t.ls1, t.fs12)}
                disabled={state === 'rendering'}
                onClick={async () => {
                  if (state === 'stopped') { // start recording
                    service.configure({ recording: true });
                    this.setState({ state: 'recording' });
                  } else if (state === 'recording') { // start rendering
                    service.configure({ recording: false });
                    this.setState({ state: 'rendering' });
                    const { gifData } = this.state;
                    const blob = await service.renderAnimatedGIF();
                    const url = URL.createObjectURL(blob);
                    await this.setImage(url);
                    URL.revokeObjectURL(gifData);
                    this.setState({ state: 'stopped' });
                  }
                }}
              >
                { state === 'stopped' && 'Record' }
                { state === 'recording' && 'Stop' }
                { state === 'rendering' && 'Rendering' }               
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
    this.encoder = undefined;

    this.prepareEncoder();
  }

  configure(config) {
    const { recording } = config;

    if (recording !== undefined) {
      this.recording = recording;
      if (this.recording) {
        this.prepareEncoder();
      }
    }
  }

  prepareEncoder = () => {
    if (!this.encoder) {
      this.encoder = new GIF({
        workers: 2,
        quality: 10,
        workerScript: 'res/gif.js/gif.worker.js'
      });
    }
  }

  releaseEncoder = () => {
    this.encoder = undefined;
  }

  renderAnimatedGIF = () => {
    return new Promise(resolve => {
      this.encoder.on('finished', blob => {
          resolve(blob);
          this.releaseEncoder();
        }
      );
      if (this.encoder) {
        this.encoder.render();
      }
    });
  }

  urlToImage = url => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = url;
    });
  }

  async process(params) {
    if (params instanceof Blob && this.recording) {
      const url = URL.createObjectURL(params);
      const results = await Promise.all([
        this.app.notify(this, { imageUrl: url }),
        this.urlToImage(url)
      ]);
      const image = results[1];
      this.encoder.addFrame(image, { delay: 1 });
      URL.revokeObjectURL(url);
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
