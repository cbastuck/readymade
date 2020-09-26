import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/trigger-pad';
const serviceName = 'Trigger Pad';

function makeIndex(rowIndex, colIndex) {
  return `${rowIndex * 4 + colIndex}`;
}

class TriggerPadUI extends Component {
  state = {
    triggeredPads: {},
    assignments: {},
  };


  onInit = service => {
    this.service = service;
  }

  onNotification = (service, notification) => {
    const { assignments } = notification;
    if (assignments) {
      this.setState({ assignments });
    }
  }

  renderPad = (service, rowIndex, colIndex) => {
    const index = makeIndex(rowIndex, colIndex);
    const isPadTriggered = this.state.triggeredPads[index];
    const isPadAssigned = this.state.assignments[index];
    return (
      <div
        style={{
          width: 100,
          height: 100,
          margin: 2,
          border: 'solid 1px lightgray',
          backgroundColor: !isPadTriggered ? 
            (isPadAssigned ? '#eff' : 'white') : 
            '#4183c4'
        }}
        onMouseDown={() => {
          service.triggerPad(index);
          this.setState({ 
            triggeredPads: {
              ...this.state.triggeredPads,
              [index]: true
            }
          });
        }}
        onMouseUp={() => {
          this.setState({ 
            triggeredPads: {
              ...this.state.triggeredPads,
              [index]: false
            }
          });
        }}
        onMouseLeave={() => {
          if (isPadTriggered) {
            this.setState({ 
              triggeredPads: {
                ...this.state.triggeredPads,
                [index]: false
              }
            });
          }
        }}
      >  
      </div>
    );
  }

  renderRow = (service, rowIndex) => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        { this.renderPad(service, rowIndex, 0) }
        { this.renderPad(service, rowIndex, 1) }
        { this.renderPad(service, rowIndex, 2) }
        { this.renderPad(service, rowIndex, 3) }
      </div>
    );
  }

  renderMain = service => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        { this.renderRow(service, 0) }
        { this.renderRow(service, 1) }
        { this.renderRow(service, 2) }
        { this.renderRow(service, 3) }        
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    )
  }
}

class TriggerPad {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.armedPad = 0;
    this.padAssignments = {};
  }

  configure(config) { 
  }

  padAssignment(padIndex) {
    return this.padAssignments[padIndex];
  }

  triggerPad(padIndex) {
    const assignment = this.padAssignment(padIndex);
    if (assignment) {
      return this.app.next(this, assignment);
    }
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
    new TriggerPad(app, board, descriptor, id),
  createUI: TriggerPadUI,
};

export default descriptor;
