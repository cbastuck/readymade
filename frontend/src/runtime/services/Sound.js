import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import * as Tone from 'tone';

import ServiceUI from './ServiceUI';

import { s, t } from '../../styles';

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
          <span style={s(t.uc, t.ls1, t.fs11)}>
            { 
              this.state.running ? 
                'Stop Audio' : 'Start Audio' 
            }
          </span> 
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
  }

  configure(config) {
    const { generator } = config;
    switch (generator) {
      case 'synth':
        this._synth = new Tone.Synth().toMaster();
      break;
      case 'sampler':
        this._sampler = new Tone.Sampler({
          urls: config.samplerUrls,
          baseUrl: config.samplerBaseUrl,
          onload: () => {
          }
        }).toMaster();
        break;
      default: 
        console.error(`Unknown generator: ${generator}`);
    }
  }

  process(params) {
    const { note = 'C4', duration = '4n' } = params || {};
    if (Tone.Transport.state !== 'started') {
      return params;
    }
    
    if (this._sampler) {
      this._sampler.triggerAttackRelease([note], duration);
    }
    if (this._synth) {
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
