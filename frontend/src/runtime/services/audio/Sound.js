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
    sampleMap: {
      A3: 'http://localhost/assets/audio/A1.mp3',
    }
  };

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  onNotification = (service, notification) => {    
    const { 
      running,
      samples,
    } = notification;
    if (running !== undefined && 
        running !== this.state.running) {
      this.setState({ running });
    }

    if (samples !== undefined) {
      this.setState({ sampleMap: samples });
    }
  }

  createGeneratorOptions = generator => {
    const { sampleMap } = this.state;
    const params = generator === 'sampler' ? 
      { urls: sampleMap} : 
      { };
    return { type: generator, ...params };
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
    const { running, sampleMap } = this.state;
    const onClick = () => {
      const toggled = !running;
      service.configure({ 
        running: toggled,
        generator: {
          type: 'sampler',
          urls: sampleMap,
        }
      });
      this.setState({ running: toggled });
    }
    const mapping = Object.keys(sampleMap).map(key => ({ key, sample: sampleMap[key]}));
    return (
      <div>
        {
          mapping.map(m => (
            <InputField
              key={`sample-mapping-${m.key}`}
              label={m.key}
              value={m.sample}
            />
          ))
        }
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
            const g = this.createGeneratorOptions(generator);
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
    return new Promise(async (resolve, reject) => {
      const { urls={} } = params;
      const samples = {};
      for (const key of Object.keys(urls)) {
        const sample = urls[key];
        samples[key] = sample instanceof Blob ?
          await toAudioBuffer(sample) : 
          sample;
      }
      const sampler = new Tone.Sampler({
        urls: samples,
        onload: () => resolve(sampler),
      });

      this.app.notify(this, { samples });
    });
  }

  async configure(config) {
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
