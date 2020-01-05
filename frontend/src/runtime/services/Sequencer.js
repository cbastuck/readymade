import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/sequencer';
const serviceName = 'Sequencer';

function resolveTransferItem(dataTransferItem) {
  return new Promise(resolve => {
    const { kind, type } = dataTransferItem;
    dataTransferItem.getAsString(str => resolve({
      type,
      kind,
      data: str
    }))
  });
}

class Step extends Component {
  allowDrop = ev => true; // TODO: allow everything

  onDrop = async ev => {
    console.log('DROPPED SOMETHING', ev.dataTransfer.files.length, ev.dataTransfer.items.length);
    for (let i=0; i<ev.dataTransfer.files.length; ++i) {
      console.log("f--->", ev.dataTransfer.files[i])
    }

    for(let i=0; i<ev.dataTransfer.items.length; ++i) {
      const item = ev.dataTransfer.items[i];
      return await resolveTransferItem(item); // TODO: returning the first item
    }
    return true;
  }

  render() {
    const { active, onClick, onData } = this.props;
    return (
      <div
        style={{
          backgroundColor: active ? 'lightgray' : 'white',
          border: active ? 'solid 1px white' : 'solid 1px gray',
          width: 50,
          height: 50
        }}
        onClick={onClick}
        onDragOver={ev => this.allowDrop(ev) && ev.preventDefault()}
        onDrop={async ev => {
          ev.preventDefault();
          const data = await this.onDrop(ev);
          onData(data);
        }}
      >
      </div>
    );
  }
}

class SequencerUI extends Component {
  state = {
    currentStep: 0
  }

  update = currentStep => {
    this.setState({ currentStep })
  }

  render() {
    return (
      <ServiceUI {...this.props}>
      {
        ({ service }) => (
          service && service.register(this.update) && (
            <div 
              style={{ 
                display: 'flex',
                flexDirection: 'row',
                margin: 10
              }}
            >
              {
                service.steps.map((stepData, idx) => (
                  <Step
                    key={`step-${idx}`}
                    data={stepData}
                    position={idx}
                    active={this.state.currentStep === idx}
                    onClick={() => service.setCurrentStep(idx)}
                    onData={data => service.setStepData(idx, data)}
                  />
                ))
              }
            </div>
          )
        )
      }
    </ServiceUI>
    )
  }
}

class Sequencer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.steps = new Array(10).fill(undefined).map((_, i) => ({ step: i }));
    this.currentStep = 0;
    this.repeat = true;
  }

  register(callback) {
    this.callback = callback;
    return true;
  }

  setCurrentStep(step) {
    this.currentStep = step;
    if (this.callback) {
      this.callback(this.currentStep);
    }
  }

  setStepData(step, data) {
    this.steps[step] = data;
  }

  configure(config) {
    if (config.steps !== undefined) {
      this.steps = config.steps;
    }

    if (config.repeat !== undefined) {
      this.repeat = config.repeat;
    }

    if (config.conditions !== undefined) {
      this.conditions = config.conditions;
    }
  }

  checkCondition(inData, refData, op) {
    switch (op) {
      case 'less':
      console.log('!!!!', inData, refData)
        return inData < refData;
      default:
        break;
    }
    return false;
  }

  process(params) {
    if (!this.repeat && this.currentStep >= this.steps.length) {
      return undefined;
    }
    
    if (this.conditions) {
      const condition = this.conditions[this.currentStep];
      if (condition) {
        const inputData = params[condition.property];
        const refData = condition.value;
        const fulfilled = this.checkCondition(inputData, refData, condition.operation);
        if (fulfilled) {
          ++this.currentStep;
        }
      }
    } else {
      ++this.currentStep;
    }

    const n = this.currentStep % this.steps.length;
    if (this.callback) {
      this.callback(n);
    }
    if (Array.isArray(params)) {
      return params.concat(this.steps[n]);
    } else {
      return this.steps[n];
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Sequencer(app, board, descriptor, id),
  createUI: SequencerUI
};

export default descriptor;
