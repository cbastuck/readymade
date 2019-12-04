import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/timeline';
const serviceName = 'Timeline';

class Step extends Component {
  render() {
    const { active, onClick } = this.props;
    return (
      <div
        style={{
          backgroundColor: active ? 'lightgray' : 'white',
          border: active ? 'solid 1px white' : 'solid 1px gray',
          width: 50,
          height: 50
        }}
        onClick={onClick}
      >
      </div>
    );
  }
}

class TimelineUI extends Component {
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

class Timeline {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.steps = new Array(10).fill(undefined).map((_, i) => ({ step: i }));
    this.currentStep = 0;
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

  process() {
    const n = ++this.currentStep % this.steps.length;
    if (this.callback) {
      this.callback(n);
    }
    return this.steps[n];
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Timeline(app, board, descriptor, id),
  createUI: TimelineUI
};

export default descriptor;
