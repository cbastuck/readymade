import React, { Component } from 'react';
import { 
  Button,
} from 'semantic-ui-react';
import * as Tone from 'tone';

import ServiceUI from '../ServiceUI';
import SelectorField from '../../../components/shared/SelectorField';
import InputField from '../../../components/shared/InputField';
import { s, t } from '../../../styles';
import { toAudioBuffer } from './audioHelper';

const serviceId = 'hookup.to/service/sound';
const serviceName = 'Sound';

class SoundUI extends Component {
  state = {
    running: false,
    generator: { type: 'synth' },
    sampleUrl: 'http://localhost/assets/audio/A1.mp3',
  };

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  onNotification = (service, notification) => {    
    const { running } = notification;
    if (running !== this.state.running) {
      this.setState({ running });
    }
  }

  renderStartStopButton = (running, onClick) => {
    return (
      <Button 
        style={{ width: '100%', marginTop: 5 }}
        onClick={onClick}
      >
        <span style={s(t.uc, t.ls1, t.fs11)}>
          {
            running ? 'Stop Audio' : 'Start Audio' 
          }
        </span> 
      </Button>
    );
  }

  renderGeneratorSynth = service => {
    const { running } = this.state;
    const onClick = () => {
      const toggled = !running;
      service.configure({ 
        running: toggled,
        generator: { type: 'synth' }
      });
      this.setState({ running: toggled });
    }
    return this.renderStartStopButton(running, onClick);
  }

  renderGeneratorSampler = service => {
    const { running, sampleUrl } = this.state;
    const onClick = () => {
      const toggled = !running;
      service.configure({ 
        running: toggled,
        generator: {
          type: 'sampler',
          urls: { A3:  sampleUrl },
        }
      });
      this.setState({ running: toggled });
    }
    return (
      <div>
        <InputField
          label="Sample URL"
          value={sampleUrl}
        />
        {
          this.renderStartStopButton(running, onClick)
        }
      </div>
    );
  }

  renderMain = service => {
    const { generator } = this.state;
    const generatorOptions = {
      synth: 'Sine Synth',
      sampler: 'Sampler',
    };
    return (
      <div style={{ minWidth: 250 }}>
        <SelectorField
          label="Generator"
          options={generatorOptions}
          value={generator && generator.type}
          onChange={async (_ev, { value: generator }) => {
            const g = { type: generator };
            await service.configure({ 
              generator: g,
              running: false,
            });
            this.setState({ generator: g });
          }}
        />
        { generator && generator.type === 'synth' && this.renderGeneratorSynth(service) }
        { generator && generator.type === 'sampler' && this.renderGeneratorSampler(service) }
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit}
        onNotification={this.onNotification}
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

    this.generator = { type: 'synth' };
  }

  destroy() {
    this.cleanup();
  }

  cleanup = () => {
    if (this._synth) {
      this._synth.disconnect();
      this._synth.dispose();
      this._synth = null;
    }

    if (this._sampler) {
      this._sampler.disconnect();
      this._sampler.dispose();
      this._sampler = null;
    }
  }

  createSampler = params => {
    return new Promise((resolve, reject) => {
      const sampler = new Tone.Sampler({
        ...params,
        onload: () => resolve(sampler),
      });
    });
  }

  async configure(config) {
    const { 
      generator,
      running,
      sample,
    } = config;

    if (sample !== undefined) {
      this.cleanup();
      const ab = await toAudioBuffer(sample); 
      const p = { urls: { C4: ab } };
      console.log('!!! configue', p);
      this._sampler = await this.createSampler(p);
      this._sampler.toDestination();
    }


    if (generator !== undefined) {
      this.generator = generator;
      switch (generator.type) {
        case 'synth': 
          this.cleanup();
          this._synth = new Tone.PolySynth(generator)
          this._synth.toDestination();
        break;
        case 'sampler':
          this.cleanup();
            this._sampler = await this.createSampler(generator);
            this._sampler.toDestination();
          break;
        default: 
          console.error(`Unknown generator: "${generator.type}"`);
      }
    }

    if (running !== undefined) {
      if (running) {
        Tone.Transport.start();              
      } else {
        Tone.Transport.stop();
      }
      this.app.notify(this, { running });
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
