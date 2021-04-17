import React, { Component } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

import { isObject } from './helpers';
import SelectorField from '../../components/shared/SelectorField';
import ServiceUI from './ServiceUI';
import { t } from '../../styles';

const serviceId = 'hookup.to/service/chart';
const serviceName = 'Chart';

function reduce(obj, selector='*') {
  return Object.keys(obj)
    .filter(key => selector === '*' || key === selector)
    .reduce(
      (acc, key) => {
        const value = obj[key];
        const n = isObject(value) ? 
          reduce(value) : // TODO: apply selector only on first level
          Number(value);
        return acc + n;
      },
      0 
    );
}

const palette = {};
function getColorFor(val) {
  const existingCol = palette[val];
  if (existingCol) {
    return existingCol;
  }
  const rnd = () => Math.round(Math.random() * 255);
  const newCol = `rgb(${rnd()},${rnd()},${rnd()})`;
  palette[val] = newCol;
  return newCol;
}


function createDataset(data=[], selector='*') {
  return {
    label: selector,
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
    data,
  };
}

class ChartUI extends Component {
  state = {
    data: {
      labels: [],
      datasets: [
        createDataset()
      ]
    },
    selector: '*'
  }

  onInit = initialConfig => {
  }

  onNotification = (service, config) => {
    const { params } = config;
    if(params !== undefined) {
      this.updateData(params);
    }
  }

  updateData = (data, selector) => {
    const dataKeys = Object.keys(data);
    const values = dataKeys.map(key => reduce(data[key], selector || this.state.selector));
    const firstValueKeys = dataKeys[0] ? Object.keys(data[dataKeys[0]]) : [];
    const selectorOptions = firstValueKeys.reduce(
      (acc, cur) => ({ ...acc, [cur]: cur }), 
      { '*': '* [all]' }
    );
    const labels = Object.keys(data);
    const updated = {
      labels,
      datasets: [ 
        createDataset(values,  selector)
      ]
    };
    this.setState({ 
      data: updated, 
      rawData: data,
      selectorOptions,
    });
  }

  renderLine = service => {
    const { data, rawData } = this.state;
    return (
      <Line 
        data={data}
        onElementsClick={elems => {
          const elem = elems[0];
          if (elem) {
            const keys = Object.keys(rawData);
            const clickedKey = keys[elem._index];
            service.app.next(service, { [clickedKey]: rawData[clickedKey] }); // TODO: not here
          }
        }}
      />
    );
  }

  renderDoughnut = service => {
    const { rawData, selector } = this.state;
    const rawKeys = Object.keys(rawData);
    const scalarData = rawData[rawKeys[0]];
    const labels = Object.keys(scalarData[selector] || {});
    const data = labels.map(key => scalarData[selector][key]);
    return (
      <Doughnut
        options={{
         legend: {
            display: labels.length < 10
          }
        }}
        data={{
          labels,
          datasets: [
            { 
              label: selector,
              data,
              backgroundColor: [
                'rgb(255, 99, 132)',
                'rgb(54, 162, 235)',
                'rgb(255, 205, 86)'
              ],
            }
          ]
        }}
      />
    );
  }

  renderStackedBar = service => {
    const { rawData, selector } = this.state;
    if (selector === '*') {
      return <div>Make a selection</div>;
    }
    const labels = rawData ? Object.keys(rawData) : [];
    const values = labels.map(key => rawData[key]);
    const selected = values.map(val => val[selector]);
    const distinct = selected.reduce(
      (all, cur) => {
        const newKeys = Object.keys(cur).filter(k => all.indexOf(k) === -1);
        return [...all, ...newKeys];
      }, 
      []
    );
    
    const datasets = distinct.map(val => ({ 
      label: val,
      data: labels.map(key => rawData[key][selector][val] || 0),
      backgroundColor: getColorFor(val),
    }));
    return (
      <Bar
        onElementsClick={elems => {
          const idx = elems[0]._index;
          const value = { [labels[idx]]: values[idx] };
          service.inject(value); // TODO
        }}
        options={{
          scales: {
            xAxes: [{ stacked: true }],
            yAxes: [{ stacked: true }]
          },
          legend: {
            display: distinct.length < 10
          }
        }}
        data={{
          labels,
          datasets,
        }}
      />
    );
  }

  renderMain = service => {
    const { rawData, selector, selectorOptions } = this.state;
    const isScalar = rawData && Object.keys(rawData).length === 1;
    return (
      <div style={t.fill}>
        <SelectorField
          style={t.mb5}
          label="Selector"
          options={selectorOptions}
          value={selector}
          onChange={(ev, { value: selector }) => {
            this.setState(
              { selector },
              () => this.updateData(rawData, selector)
            );
          }}
        />
        {
          !isScalar ? 
            this.renderStackedBar(service) : 
            this.renderDoughnut(service)
        }
      </div>
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

  inject(params) {
    this.app.next(this, params);
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
