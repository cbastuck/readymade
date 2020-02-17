import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/map';
const serviceName = 'Map';

function evil(f, params) {
  return eval(f);
}

class MapUI extends Component {
  onInit(initialState) {
    const { bla } = initialState;
    this.setState({
      bla
    });
  }

  render() {
    const marginStyle = { margin: '10px 5px' };
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div style={marginStyle}>
          </div>
        )
      }
      </ServiceUI>
    );
  }
}

class Map {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { template } = config;
    if (template !== undefined) {
      const terms = {};
      this.template = Object.keys(template).reduce(
        (all, cur) => {
          const value = template[cur];
          if (cur[cur.length - 1] === '=') {
            terms[cur.substr(0, cur.length - 1)] = value;
            return all;
          } else {
            return { ...all, [cur]: value };
          }
        }, 
        {}
      );
      this.terms = terms;
    }
  }

  process(params) {
    return params.map(x => ({
      ...this.template,
      ...Object.keys(this.terms).reduce(
        (p, c) => ({ ...p, [c]: evil(this.terms[c], x) }),
        {}
      )
      //x: `${Math.floor(sample[0] * 100)}%`,
      //y: `${Math.floor(sample[1] * 100)}%`,
    }));
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Map(app, board, descriptor, id),
  createUI: MapUI
};

export default descriptor;
