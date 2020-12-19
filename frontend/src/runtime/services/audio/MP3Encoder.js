import { Mp3Encoder, WavHeader } from 'lamejs';

const serviceId = 'hookup.to/service/mp3encoder';
const serviceName = 'MP3Encoder';

class Encoder {
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
      fr.addEventListener('error', error => reject(console.error('ERROR!!!', error)));
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
    new Encoder(app, board, descriptor, id),
  createUI: undefined
};

export default descriptor;
