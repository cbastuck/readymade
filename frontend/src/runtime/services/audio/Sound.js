import React, { Component } from 'react';
import { 
  Button,
} from 'semantic-ui-react';
import * as Tone from 'tone';

import ServiceUI from '../ServiceUI';
import SelectorField from '../../../components/shared/SelectorField';
import InputField from '../../../components/shared/InputField';
import { s, t } from '../../../styles';

const serviceId = 'hookup.to/service/sound';
const serviceName = 'Sound';

class SoundUI extends Component {
  state = {
    running: false,
    generator: 'synth',
    sampleUrl: 'http://localhost/assets/audio/A1.mp3',
  };

  onInit = initialState => {
    this.setState({ ...initialState });
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
    const onClick = () => { }
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
          onload: () => console.log('SAMPLES LOADED')
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
          value={generator}
          onChange={async (_ev, { value: generator }) => {
            this.setState({ generator });
          }}
        />
        { generator === 'synth' && this.renderGeneratorSynth(service) }
        { generator === 'sampler' && this.renderGeneratorSampler(service) }
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

    this.generator = 'synth';
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

  configure(config) {
    const { 
      generator,
      running,
    } = config;

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
          this._sampler = new Tone.Sampler(generator);
          this._sampler.toDestination();
          break;
        default: 
          console.error(`Unknown generator: ${generator}`);
      }
    }

    if (running !== undefined) {
      if (running) {
        Tone.Transport.start();              
      } else {
        Tone.Transport.stop();
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
