import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import * as Tone from 'tone';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/sound';
const serviceName = 'Sound';

class SoundUI extends Component {
  onInit = initialState => {
    this.setState({ ...initialState });
  }

  renderMain = () => {
    return (
      <div>
        <Button 
          style={{ width: '100%' }}
          onClick={() => {
            Tone.Transport.on('start', ev => {
              console.log('Position', ev)
            });
            Tone.Transport.start();
          }}
        >
          Start Audio
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
    if (this._synth) {
      this._synth.triggerAttackRelease('C4', '8n');
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
