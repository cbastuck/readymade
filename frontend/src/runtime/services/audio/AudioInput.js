import React, { Component } from 'react';
import {
  Button,
  Checkbox,
} from 'semantic-ui-react';

import MediaRecorder from 'audio-recorder-polyfill';

import ServiceUI from '../ServiceUI';
import InputField from '../../../components/shared/InputField';
import HoldableButton from '../../../components/shared/HoldableButton';

import { s, t } from '../../../styles';

const serviceId = 'hookup.to/service/audio-input';
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

  onNotification = (service, notification) => {
    const { 
      isRecording=this.state.recording, 
      timeslice=this.state.timeslice,
      availableDevices=this.state.devices
    } = notification;

    this.setState({ 
      recording: isRecording,
      timeslice: timeslice,
      devices: availableDevices
    });
  }

  renderDevices = service => {
    const { devices=[] } = this.state;
    return (
      <div>
        <ol>
        { 
          devices.filter(device => device.kind === 'audioinput')
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
                  this.reInitVisualizer(service._stream);
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
      fontSize: 11,
      marginTop: 2,
      marginBottom: 2,
    };
    const onStartRecording = () => {
      service.startRecorder();
      this.setState({ pushRecording: true });
    };
    const onStopRecording = () => {
      service.stopRecorder();
      this.setState({ pushRecording: false });
    };
    return (
      <div
        style={{
          margin: '0px 5px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
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
            style={s(t.uc, t.fs11, t.ls1)}
            label="Visualize"
            checked={this.state.visualize}
             onChange={async (_, { checked }) => {
                this.setState(
                  { visualize: checked },
                  () => this.visualize(service._stream)
                );
             }}
            toggle
          />
        </div>
        <HoldableButton
          style={s(t.uc, t.ls1, t.bc('#e0e1e2'), t.p5, t.tc, t.fs11, t.br3)}
          onDown={onStartRecording}
          onUp={onStopRecording}
        >
          { !this.state.pushRecording ? 'Push to Record' : 'Recording ...' }
        </HoldableButton>
        <div
          style={{
            marginTop: 1,
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
    if (!this._audioCtx && stream) {
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
    if (!this.canvas || !this.state.visualize || !this._audioCtx) {
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
        onNotification={this.onNotification.bind(this)}
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
    this._stream = undefined;

    this.prepareStream();
  }

  async configure(config) {
    const { 
      timeslice, 
      device, 
    } = config;

    if (timeslice !== undefined) {
      this.timeslice = timeslice;
      this.app.notify(this, { timeslice });
    }

    if (device !== undefined) {
      await this.prepareStream(device);
    }
  }

  async prepareStream(device) {
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      const updateDeviceList = async () => {
        this.availableDevices = await navigator.mediaDevices.enumerateDevices();
        this.app.notify(this, { availableDevices: this.availableDevices });
      }  
      navigator.mediaDevices.ondevicechange = updateDeviceList;
      await updateDeviceList();
    }

    if (navigator.mediaDevices) {
      if (!device) {
        this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        this._stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: device.deviceId }} });
      }
    }
    
    return this._stream;
  }

  async startRecorder(timeslice) {
    try {
      if (!this.recorder) {
        this.recorder = new MediaRecorder(this._stream);
        this.recorder.addEventListener(
          'dataavailable', 
          e => this.app.next(this, e.data)
        );
      }
      this.recorder.start(timeslice);
      this.isRecording = true;
      this.app.notify(this, { isRecording: true });
    } catch (err) {
      console.error('AudioInput error', err);
    }
  }

  stopRecorder() {
    if (this.recorder) {
      this.recorder.stop();
      //this._stream.getAudioTracks()[0].stop();
      //this._stream = this.recorder = undefined;
      this.isRecording = false;
      this.app.notify(this, { isRecording: false });
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
