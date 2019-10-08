import { Mp3Encoder, WavHeader } from 'lamejs';

const serviceId = 'hookup.to/service/mp3encoder';
const serviceName = 'MP3Encoder';

class Encoder {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
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

  async process(blob) {
    const ab = await this.toArrayBuffer(blob);
    const header = WavHeader.readHeader(new DataView(ab));

    const encoder = new Mp3Encoder(header.channels, header.sampleRate, 128);
    const samples = new Int16Array(ab, header.dataOffset, header.dataLen / 2);
    var mp3Tmp = encoder.encodeBuffer(samples);
    var mp3Data = [];
    mp3Data.push(mp3Tmp);
    mp3Tmp = encoder.flush()
    mp3Data.push(mp3Tmp);
    var mp3blob = new Blob(mp3Data, {type: 'audio/mp3'});
    return this.app.next(this, mp3blob);
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
