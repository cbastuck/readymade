import React, { Component } from 'react';

import ServiceUI from '../ServiceUI';
import SelectorField from '../../../components/shared/SelectorField';

import { Mp3Encoder, WavHeader } from 'lamejs';

const serviceId = 'hookup.to/service/mp3encoder';
const serviceName = 'MP3Encoder';

class MP3EncoderUI extends Component {
  state = {};
  
  onInit = initialState => {
    const { 
      bitrate='128',
    } = initialState;
    this.setState({ bitrate });
  }

  renderMain = service => {
    const { bitrate } = this.state;
    return (
      <div>
        <SelectorField 
          label="Bitrate"
          value={bitrate}
          options={{
            '128': '128',
            '64': '64',
            '32': '32',
          }}
          onChange={(_ev, { value: bitrate }) => 
            this.setState({ bitrate })
          }
        />
      </div>
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[ 
          { name: 'main', render: this.renderMain }
        ]}
      />
    );
  }
}

class MP3Encoder {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.bitrate = 128;
  }

  configure(config) {
    if (config.bitrate !== undefined) {
      this.bitrate = config.bitrate;
    }
  }

  toArrayBuffer(blob) {
    if (blob.arrayBuffer) {
      return blob.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.addEventListener('error', error => reject(console.error('Error in MP3Encoder service: ', error)));
      fr.onload = () => resolve(fr.result);
      fr.readAsArrayBuffer(blob);
    });
  }

  async process(params) {
    if (params instanceof Blob) {
      const ab = await this.toArrayBuffer(params);
      const header = WavHeader.readHeader(new DataView(ab));
      const encoder = new Mp3Encoder(header.channels, header.sampleRate, this.bitrate);
      const samples = new Int16Array(ab, header.dataOffset, header.dataLen / 2);
      const mp3Data = [
        encoder.encodeBuffer(samples),
        encoder.flush()
      ];
      return new Blob(mp3Data, { type: 'audio/mp3' });
    }
    return params;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new MP3Encoder(app, board, descriptor, id),
  createUI: MP3EncoderUI
};

export default descriptor;
