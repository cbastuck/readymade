import React, { Component } from 'react';
import {
  Button,
} from 'semantic-ui-react';

import ServiceUI from '../ServiceUI';

const serviceId = 'hookup.to/service/midi-input';
const serviceName = 'Midi Input';

class MidiInputUI extends Component {
  state = {
    inputs: [],
    activeDevice: null,
  };

  onNotification = (service, notification) => {
    const { devices, activeDevice } = notification;
    if (devices !== undefined) {
      this.setState({ inputs: devices });
    }

    if (activeDevice !== undefined) {
      this.setState({ activeDevice })
    }
  }

renderDevices = (service, devices) => {
    return (
      <div>
        <ol>
        { 
          devices.map((device, idx) => {
            const isActiveDevice = this.state.activeDevice && this.state.activeDevice.name === device.name;
            return (
              <li 
                key={`midi-input-${idx}`}
                style={{ 
                  textAlign: 'left',
                  color: isActiveDevice && '#4183c4',
                }}
              >
                { device.name }
                <Button
                  style={{ 
                    width: 60, 
                    height: 20, 
                    padding: 0, 
                    margin: '1px 10px', 
                    textTransform: 'uppercase', 
                    fontSize: 11,
                  }}
                  onClick={async () => {
                    service.configure({ input: device.name });
                  }}
                  disabled={isActiveDevice}
                >
                  Activate
                </Button>
              </li>
            );
          })
        }
        </ol>
      </div>
    );
  }

  renderMain = service => {
    const { inputs } = this.state;
    return (
      <div>
        { this.renderDevices(service, inputs) }
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onNotification={this.onNotification.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    )
  }
}

class MidiInput {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app; 

    this.activeDevice = undefined;
    this.devices = [];
    this.init();
  }

  async init() {
    if (!this.midi) {
      this.midi = await navigator.requestMIDIAccess();
      this.devices = Array.from(this.midi.inputs.values());
      if (this.devices.length > 0) {
        this.app.notify(this, { devices: this.devices });
        await this.configure({ input: this.devices[0].name });
      }
    }
  }

  async configure(config) { 
    if (!this.midi) {
      await this.init(); // make sure we're initialized
    }

    const { input } = config;
    if (input !== undefined) {
      for (const device of this.devices) {
        if (device.name === input) {
          if (this.activeDevice) {
            await this.activeDevice.close();
            this.activeDevice.onmidimessage = undefined;
            this.activeDevice = null;
          }
          device.onmidimessage = this.onMidi.bind(this);
          this.activeDevice = device;
          this.app.notify(this, { activeDevice: device });
          return;
        }
      }
    }
  }

  onMidi(message) {
    const msg = {
      command: message.data[0] >> 4,
      channel: message.data[0] & 0xf,
      note: message.data[1],
      velocity: message.data[2] / 127
    };
    this.dispatchMidiMessage(msg);
  }

  dispatchMidiMessage(msg) {
    const {command, channel, note, velocity} = msg

    const octave = note && Math.floor(note / 12) - 1;
    const noteName = note && ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][note % 12];
    const event = { command, velocity, channel, note, octave, noteName };
    switch (command) {
      case 8: 
        event.action = 'noteoff';
      break;
      case 9:
        event.action = 'noteon';
      break;
      case 11:
        event.action = 'poti';
      break;
      case 14:
        event.action = 'pitchbend';
      break;
      default:
      break;
    }
    this.app.next(this, event);
  }

  async process(params) {
    if (params instanceof Blob) {
      if (this.armedPad !== undefined) {
        const idx = `${this.armedPad}`;
        this.padAssignments[idx] = params;
        this.armedPad = ++this.armedPad % 16;
        this.app.notify(this, { assignments: this.padAssignments })
      }
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new MidiInput(app, board, descriptor, id),
  createUI: MidiInputUI,
};

export default descriptor;
