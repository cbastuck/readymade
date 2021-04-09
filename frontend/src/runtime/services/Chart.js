import React, { Component } from 'react';
import { Line } from 'react-chartjs-2';
import { isObject } from './helpers';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/chart';
const serviceName = 'Chart';

function reduce(obj) {
  return Object.keys(obj)
    .reduce((acc, key) => {
      const value = obj[key];
      const n = isObject(value) ? 
        reduce(value) : 
        Number(value);
      return acc + n;
    },
    0 
  );
}

function createData(data) {
  return {
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
    data
  };
}

class ChartUI extends Component {
  state = {
    propertyX: '',
    propertyY: '',
    data: {
      labels: [],
      datasets: [
        createData()
      ]
    }
  }

  onInit = initialConfig => {}

  onNotification = (service, config) => {
    const { params } = config;
    if(params !== undefined) {
      this.updateData(params);
    }
  }

  updateData(data) {
    const values = Object.keys(data).map(date => reduce(data[date]));
    const labels = Object.keys(data);
    const updated = {
      labels,
      datasets: [
        {
          ...this.state.data.datasets[0],
          data: values
        }
      ]
    };
    this.setState({ data: updated });
  
  }

  renderMain = service => {
    const { data } = this.state;
    return (
      <Line 
        data={data} 
      />
    );
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
          onInit={this.onInit}
          onNotification={this.onNotification}
          segments={[
            { name: 'main', render: this.renderMain },
          ]}
        />
      </div>
    );
  }
}

class Chart {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {

  }


  async process(params) {
    this.app.notify(this, { params });
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Chart(app, board, descriptor, id),
  createUI: ChartUI
};

export default descriptor;
