import React, { Component } from 'react';
import {
  Button,
  Checkbox,
} from 'semantic-ui-react';

import MediaRecorder from 'audio-recorder-polyfill';

import ServiceUI from './ServiceUI';
import InputField from '../../components/shared/InputField';

const serviceId = 'hookup.to/service/microphone'; // TODO: change to audio-input
const serviceName = 'Audio Input';

class AudioInputUI extends Component {
  state = {
    recording: false,
    visualize: true,
    devices: [],
  };

  onInit = async service => {
    if (this.state.visualize) {
      const stream = await service.prepareStream();
      this.visualize(stream);
      this.setState({ 
        devices: service.availableDevices,
        timeslice: service.timeslice,
      });
    }
  }

  onTimer = service => {
    this.setState({ 
      recording: service.isRecording,
      timeslice: service.timeslice,
    });
  }

  renderDevices = service => {
    return (
      <div>
        <ol>
        { 
          this.state.devices
            .filter(device => device.kind === 'audioinput')
            .map((device, idx) => (
            <li 
              key={`device-${idx}`}
              style={{ textAlign: 'left' }}
            >
              { device.label }
              <Button
                style={{ 
                  width: 60, 
                  height: 20, 
                  padding: 0, 
                  margin: '1px 10px', 
                  textTransform: 'uppercase', 
                  fontSize: 11 
                }}
                onClick={async () => {
                  await service.configure({ device });
                  this.reInitVisualizer(service.stream);
                }}
              >
                Activate
              </Button>
            </li>
          )) 
        }
        </ol>
      </div>
    );
  }

  renderMain = service => {
    const buttonStyle = {
      textTransform: 'uppercase', 
      fontSize: 12,
    };
    return (
      <div
        style={{
          margin: '0px 5px',
          textAlign: 'left'
        }}
      >
        <div>
          <canvas 
            ref={canvas => {
              if (canvas) {
                this.canvas = canvas;
                this.canvasCtx = canvas.getContext('2d');
              }
            }}
            height={100}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ margin: '5px 0px' }}>
          <Checkbox 
            label="Visualize" 
            checked={this.state.visualize}
             onChange={async (_, { checked }) => {
               this.setState(
                 { visualize: checked },
                () => this.visualize(service.stream)
              );
             }}
          />
        </div>
        <Button
          style={{ 
            ...buttonStyle, 
            width: '100%',
          }}
          onMouseDown={() => {
            service.startRecorder();
            this.setState({ pushRecording: true });
          }}
          onTouchStart={() => {
            service.startRecorder();
            this.setState({ pushRecording: true });
          }}
          onMouseUp={() => {
            service.stopRecorder();
            this.setState({ pushRecording: false });
          }}
          onTouchEnd={() => {
            service.stopRecorder();
            this.setState({ pushRecording: false });
          }}
          onMouseLeave={() => {
            if (this.state.pushRecording) {
              service.stopRecorder();
              this.setState({ pushRecording: false });
            }
          }}
        >
          { !this.state.pushRecording ? 'Push to Record' : 'Recording ...' }
        </Button>
        <div
          style={{
            marginTop: 5,
            display: 'flex',
            flexDirection: 'row'
          }}
        >
          <InputField 
            type="number"
            label="timeslice"
            value={this.state.timeslice}
            onChange={(_, { value }) => {
              const timeslice = Number(value);
              service.timeslice = timeslice; 
              this.setState({ timeslice: timeslice });
            }}
          />
          <Button
            style={{ ...buttonStyle }}
            onClick={() => this.state.recording ? 
              service.stopRecorder() : 
              service.startRecorder(service.timeslice)
            }
          >
            { this.state.recording ? 'Stop' : 'Record' }
          </Button>
        </div>
      </div>
    );
  }

  reInitVisualizer = stream => {
    if (!this._audioCtx) {
      return;
    }

    this._audioCtx.close();
    this._audioCtx = undefined;

    this.visualize(stream);
  }

  visualize = stream => {
    if (!this._audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext; 
      this._audioCtx = new AudioContext();
      // taken from here: https://github.com/mdn/web-dictaphone
      const source = this._audioCtx.createMediaStreamSource(stream);
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = 2048;
      source.connect(this._analyser);
    }

    this.draw();
  }

  draw = () => {
    if (!this.canvas || !this.state.visualize) {
      return;
    }

    // taken from here: https://github.com/mdn/web-dictaphone
    const bufferLength = this._analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = this.canvas.width
    const height = this.canvas.height;

    this._analyser.getByteTimeDomainData(dataArray);
  
    this.canvasCtx.fillStyle = 'white';
    this.canvasCtx.fillRect(0, 0, width, height);

    this.canvasCtx.lineWidth = 1;
    this.canvasCtx.strokeStyle = 'gray';

    this.canvasCtx.beginPath();
    const sliceWidth = width * 1.0 / bufferLength;
    for(let i = 0, x = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = v * height / 2;

      if(i === 0) {
        this.canvasCtx.moveTo(x, y);
      } else {
        this.canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    this.canvasCtx.lineTo(width, height/2);
    this.canvasCtx.stroke();

    requestAnimationFrame(this.draw);
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onTimer={this.onTimer.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
          { name: 'Devices', render: this.renderDevices },
        ]}
      />
    );
  }
}

class AudioInput {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.recorder = undefined;
    this.isRecording = false;
    this.timeslice = 1000;
    this.stream = undefined;

    this.prepareStream();
  }

  async configure(config) {
    const { 
      timeslice, 
      device, 
    } = config;

    if (timeslice !== undefined) {
      this.timeslice = timeslice;
    }

    if (device !== undefined) {
      await this.prepareStream(device);
    }
  }

  async prepareStream(device) {
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange) {
      const updateDeviceList = async () => {
        // TODO: send notification to UI
        this.availableDevices = await navigator.mediaDevices.enumerateDevices();
      }  
      navigator.mediaDevices.ondevicechange = updateDeviceList;
      await updateDeviceList();
    }

    if (navigator.mediaDevices) {
      if (!device) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: device.deviceId }} });
      }
    }
    
    return this.stream;
  }

  async startRecorder(timeslice) {
    try {
      if (!this.recorder) {
        this.recorder = new MediaRecorder(this.stream);
        this.recorder.addEventListener(
          'dataavailable', 
          e => this.app.next(this, e.data)
        );
      }
      this.recorder.start(timeslice);
      this.isRecording = true;
    } catch (err) {
      console.error('AudioInput error', err);
    }
  }

  stopRecorder() {
    if (this.recorder) {
      this.recorder.stop();
      //this.stream.getAudioTracks()[0].stop();
      //this.stream = this.recorder = undefined;
      this.isRecording = false;
    }
  }

  async process(params) {
    return params;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new AudioInput(app, board, descriptor, id),
  createUI: AudioInputUI
};

export default descriptor;
