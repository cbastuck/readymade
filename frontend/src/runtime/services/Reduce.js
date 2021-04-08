import React, { Component } from 'react';
import { 
  Checkbox,
} from 'semantic-ui-react';

import InputField from '../../components/shared/InputField';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/reduce';
const serviceName = 'Reduce';

class ReduceUI extends Component {
  onInit = initialConfig => {

  }

  onNotification = (service, notification) => {

  }

  renderMain = service => {
    return (
      <div>
        Reduce
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
    );
  }
}

class ReducedValues {
  collect(item, skip=[]) {
    Object.keys(item).forEach(key => {
      if (skip.indexOf(key) === -1) {
        if (this[key] === undefined) {
          this[key] = {};
        }
        const entry = this[key];
        const value = item[key];
        if (entry[value] === undefined) {
          entry[value] = 1;
        } else {
          ++entry[value];
        }
      }
    });
    return this;
  }
}

class Reduce {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {

  }

  process(params) {
    if (!Array.isArray(params)) {
      return params;
    }
    
    const reduceKey = 'date';
    return params
      .reduce(
        (reducedParams, paramsItem) => {
          if (!paramsItem) {
            return reducedParams;
          }
          const reduceKeyValue = paramsItem[reduceKey];
          const reducedValues = reducedParams[reduceKeyValue] || new ReducedValues();
          return { 
            ...reducedParams, 
            [reduceKeyValue]: reducedValues.collect(paramsItem, [reduceKey]),
          };
        }, 
        {}
      );
  } 
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Reduce(app, board, descriptor, id),
  createUI: ReduceUI
};

export default descriptor;
