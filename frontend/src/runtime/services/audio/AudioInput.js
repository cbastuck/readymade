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
    timeslice: 1000,
  };

  componentWillUnmount() {
    if (this._audioCtx) {
      this._audioCtx.close();
      this._audioCtx = undefined;
    }
  }

  init = async service => {
    const { timeslice, availableDevices } = service
    this.setState({ 
      devices: availableDevices,
      timeslice,
    });
  }

  onNotification = (service, notification) => {
    const { 
      isRecording, 
      timeslice,
      availableDevices,
      stream,
    } = notification;

    if (isRecording !== undefined) {
      this.setState({ recording: isRecording });
    }

    if (timeslice !== undefined) {
      this.setState({ timeslice});
    }

    if (availableDevices !== undefined) {
      this.setState({ devices: availableDevices });
    }

    if (stream !== undefined) {
      // input stream visualization
      this.visualize(stream);
    }
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
    const { 
      recording, 
      timeslice 
    } = this.state;
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
                this._canvas = canvas;
                this._canvasCtx = canvas.getContext('2d');
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
          style={s(t.uc, t.ls1, t.bc('#e0e1e2'), t.p5, t.tc, t.fs11, t.br3, { width: '99.5%', height: 30 })}
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
            value={timeslice}
            unit="msec"
            onChange={(_, { value }) => {
              const timeslice = Number(value);
              service.configure({ timeslice });
            }}
          />
          <Button
            style={{ ...buttonStyle, height: 33, marginLeft: 5 }}
            onClick={() => recording ? 
              service.stopRecorder() : 
              service.startRecorder(service.timeslice)
            }
          >
            { recording ? 'Stop' : 'Record' }
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
    if (this.state.visualize) {
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
  }

  draw = () => {
    if (!this._canvas || !this.state.visualize || !this._audioCtx) {
      return;
    }

    // taken from here: https://github.com/mdn/web-dictaphone
    const bufferLength = this._analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = this._canvas.width
    const height = this._canvas.height;

    this._analyser.getByteTimeDomainData(dataArray);
  
    this._canvasCtx.fillStyle = 'white';
    this._canvasCtx.fillRect(0, 0, width, height);

    this._canvasCtx.lineWidth = 1;
    this._canvasCtx.strokeStyle = 'gray';

    this._canvasCtx.beginPath();
    const sliceWidth = width * 1.0 / bufferLength;
    for(let i = 0, x = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = v * height / 2;

      if(i === 0) {
        this._canvasCtx.moveTo(x, y);
      } else {
        this._canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    this._canvasCtx.lineTo(width, height/2);
    this._canvasCtx.stroke();

    requestAnimationFrame(this.draw);
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.init}
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
      if (this.isRecording) {
        this.startRecorder(timeslice);
      }
    }

    if (device !== undefined) {
      await this.prepareStream(device);
    }
  }

  destroy() {
    this.stopRecorder();
    if (this._stream) {
      const tracks = this._stream ? this._stream.getTracks() : [];
      tracks.forEach(track => track.stop());
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
      if (this._stream) {
        this.app.notify(this, { stream: this._stream });
      }
    }
  }

  async startRecorder(timeslice) {
    if (this.isRecording) {
      this.stopRecorder();
    }

    try {
      if (!this.recorder) {
        this.recorder = new MediaRecorder(this._stream);
        this.recorder.addEventListener(
          'dataavailable', 
          e => {
            // TODO: there is a threshold there is only header data 
            // without content (44), using 100 as a buffer
            if (e.data && e.data.size > 100) { 
              this.app.next(this, e.data);
            }
          }
        );
      }
    } catch (err) {
      console.error('Unexpected error in AudioInput service:', err);
    }
    this.recorder.start(timeslice);
    this.isRecording = true;
    this.app.notify(this, { isRecording: true });
  }

  stopRecorder() {
    if (this.recorder) {
      this.recorder.stop();
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
