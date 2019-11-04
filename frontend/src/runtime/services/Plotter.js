import React, { Component } from 'react';
import { Line } from 'react-chartjs-2';
import moment from 'moment';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/plotter';
const serviceName = 'Plotter';

class PlotterUI extends Component {
  state = {
    propertyX: '',
    propertyY: '',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Incoming Data',
          fill: false,
          lineTension: 0.1,
          backgroundColor: 'rgba(75,192,192,0.4)',
          borderColor: 'rgba(75,192,192,1)',
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: 'rgba(75,192,192,1)',
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: 'rgba(75,192,192,1)',
          pointHoverBorderColor: 'rgba(220,220,220,1)',
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: []
        }
      ]
    }
  }

  updateData(data) {
    console.log('GOT DATA', data)
    const propertyX = this.state.propertyX;
    const propertyY = this.state.propertyY;
    if (!propertyX) {
      const keys = Object.keys(data);
      this.setState({ propertyX: keys[0]});
    }

    if (propertyX) {
      const updated = {
        labels: propertyY ? data[propertyY] : this.state.data.labels.concat(moment.utc().toISOString()),
        datasets: [
          {
            ...this.state.data.datasets[0],
            data: data[propertyX]
          }
        ]
      };
      this.setState({ data: updated });
    }
  }

  render() {
    return (
      <div
        style={{
          width: 500,
          height: 300
        }}
      >
        <ServiceUI
          {...this.props}
        >
          {
            ({ service }) => (
              service && service.register(
                data => this.updateData(data)
              ) && <Line data={this.state.data} />
            )
          }
        </ServiceUI>
      </div>
    );
  }
}

class Plotter {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
  }

  register(callback) {
    this.callback = callback;
    return true;
  }

  async process(params) {    
   if (this.callback) {
     this.callback(params);
   }
   return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Plotter(app, board, descriptor, id),
  createUI: PlotterUI
};

export default descriptor;
