import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';
import * as Tone from 'tone';

import ServiceUI from '../ServiceUI';
import { s, t } from '../../../styles';

const serviceId = 'hookup.to/service/sound';
const serviceName = 'Sound';

class SoundUI extends Component {
  state = {
    running: false
  };

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  renderMain = service => {
    const { running } = this.state;
    return (
      <div>
        <Button 
          style={{ width: '100%' }}
          onClick={() => {
            const toggled = !running;
            service.configure({ running: toggled });
            this.setState({ running: toggled });
          }}
        >
          <span style={s(t.uc, t.ls1, t.fs11)}>
            {
              running ? 'Stop Audio' : 'Start Audio' 
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

  destroy() {
    console.log('Destroying sound service')
  }

  configure(config) {
    const { 
      generator,
      running,
    } = config;

    if (running !== undefined) {
      if (running) {
        Tone.Transport.start();              
      } else {
        Tone.Transport.stop();
      }
    }

    if (generator !== undefined) {
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
