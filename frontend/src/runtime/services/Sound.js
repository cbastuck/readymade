import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import * as Tone from 'tone';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/sound';
const serviceName = 'Sound';

class SoundUI extends Component {
  state = {
    running: false
  };

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  renderMain = () => {
    return (
      <div>
        <Button 
          style={{ width: '100%' }}
          onClick={() => {
            this.setState(
              { running: !this.state.running },
              () => {
                if (this.state.running) {
                  Tone.Transport.start();              
                } else {
                  Tone.Transport.stop();
                }
              }
            );
          }}
        >
          { this.state.running ? 
              <span>Stop Audio</span> :
              <span>Start Audio</span>
          }
        </Button>
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    )
  }
}

class Sound {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    
    this._synth = new Tone.Synth().toMaster();
  }

  configure(config) {
  }

  process(params) {
    const { note = 'C4', duration = '4n' } = params || {};
    if (this._synth && Tone.Transport.state === 'started') {
      this._synth.triggerAttackRelease(note, duration);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Sound(app, board, descriptor, id),
  createUI: SoundUI,
};

export default descriptor;
