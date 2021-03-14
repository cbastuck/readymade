import React, { Component } from 'react';
import {
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from '../ServiceUI';

import { decodeBuffer } from './audioHelper';
import { toArrayBuffer } from '../helpers';
import InputField from '../../../components/shared/InputField';
import { s, t } from '../../../styles';

const serviceId = 'hookup.to/service/audio-output';
const serviceName = 'Audio Output';

class AudioOutputUI extends Component {
  state = {
    fadeInEnabled: false,
    fadeInTime: 0,
  }

  onInit = initialState => {
    const {
      fadeInTime=0,
      fadeInEnabled=fadeInTime !== 0,
    } = initialState;
    this.setState({ fadeInTime, fadeInEnabled });
  }

  renderMain = service => {
    const { 
      fadeInTime,
      fadeInEnabled,  
    } = this.state;
    return (
      <div
        style={{
          margin: '0px 5px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <canvas 
          ref={canvas => {
            if (canvas) {
              service._canvas = canvas;
              service._canvasCtx = canvas.getContext('2d');
              service.visualize();
            }
          }}
        />
        <div style={{ marginTop: 8, marginBottom: 3 }}>
          <Checkbox 
            style={s(t.uc, t.fs11, t.ls1)}
            label="Enable Fade-In/Out"
            checked={fadeInEnabled}
             onChange={async (_, { checked: fadeInEnabled }) => {
                this.setState({ fadeInEnabled });
                service.configure({ fadeInTime: fadeInEnabled ? fadeInTime : 0 });
             }}
            toggle
          />
        </div>
        <InputField
          type="number"
          label="Fade-In/Out"
          unit="msec"
          value={`${fadeInTime}`}
          onChange={(_, { value: fadeInTime }) => {
            this.setState({ fadeInTime });
            service.configure({ fadeInTime });
          }}
          disabled={!fadeInEnabled}
        /> 
      </div>
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        segments={[
          { name: 'Main', render: this.renderMain }
        ]}
      />
    );
  }
}

class AudioOutput {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    const AudioContext = window.AudioContext || window.webkitAudioContext; 
    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.connect(this.audioCtx.destination);
    this.fadeInTime = 0;
  }

  async configure(config) {
    const { fadeInTime } = config;
    if (fadeInTime !== undefined) {
      this.fadeInTime = fadeInTime;
    }
  }

  // taken from here: https://github.com/mdn/voice-change-o-matic
  visualize = () => {
    if (!this._canvas) {
      return;
    }
    const WIDTH = this._canvas.width;
    const HEIGHT = this._canvas.height;

    this.analyser.fftSize = 256;
    const bufferLengthAlt = this.analyser.frequencyBinCount;
    const dataArrayAlt = new Uint8Array(bufferLengthAlt);

    this._canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    const drawAlt = () => {
        this.analyser.getByteFrequencyData(dataArrayAlt);

        this._canvasCtx.fillStyle = 'white';
        this._canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLengthAlt) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < bufferLengthAlt; i++) {
          barHeight = dataArrayAlt[i];

          this._canvasCtx.fillStyle = `rgb(65, 131, ${barHeight+150})`;
          this._canvasCtx.fillRect(x, HEIGHT-barHeight/2, barWidth, barHeight/2);

          x += barWidth + 1;
        }
        requestAnimationFrame(drawAlt);
      };

      drawAlt();
  }

  async process(params) {
    if (params) {
      let source;
      if (params instanceof Blob || params instanceof File) {
        const ab = await toArrayBuffer(params);
        if (ab.byteLength > 0) {
          try {
            const buffer = await decodeBuffer(this.audioCtx, ab);
            source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
          } catch(err) {
            console.error('AudioOutput decodeBuffer() failed', ab, ab.byteLength > 0, ab.byteLength)
          }
        }
      }
      // TODO: do we want to allow multiple formats? Especially one that is non streamable?
      if (params instanceof AudioBuffer) {
        source = this.audioCtx.createBufferSource();
        source.buffer = params;
      }
      if (source) {      
        if (this.fadeInTime > 0) {
          const fadeInOut = this.fadeInTime / 1000;
          const duration = source.buffer.duration;
          const gainNode = this.audioCtx.createGain();
          source.connect(gainNode);
          gainNode.connect(this.analyser);
          // fade in
          gainNode.gain.linearRampToValueAtTime(0, 0);
          gainNode.gain.linearRampToValueAtTime(1, this.audioCtx.currentTime + fadeInOut);
          // fade out
          gainNode.gain.linearRampToValueAtTime(1, this.audioCtx.currentTime + duration - fadeInOut);
          gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + duration);
        } else {
          // fadein not needd - connect directly to analyser
          source.connect(this.analyser);
        }

        source.onended = () => source.disconnect();
        source.start();
      }
    }
    return params;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new AudioOutput(app, board, descriptor, id),
  createUI: AudioOutputUI
};

export default descriptor;
