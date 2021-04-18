import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';

import { FilterDescriptor } from 'services';
//import { parseExpression, evalExpression } from 'services/eval';

import ServiceUI from './ServiceUI';

class FilterUI extends Component {
  state = {};

  onInit(initialState) {
    const { 
      conditions,
      aggregator
    } = initialState;

    this.setState({
      conditions,
      aggregator,
    });
  }

  onNotification(service, notification) {
    const { 
      conditions,
      aggregator
    } = notification;

    if (conditions !== undefined) {
      this.setState({ conditions });
    }

    if (aggregator !== undefined) {
      this.setState({ aggregator });
    }
  }

  renderMain = service => {
    const { 
      conditions,
      aggregator,
    } = this.state;
    return (
      <div className="filter-service" style={{ textAlign: 'left' }}>
        {
          conditions && conditions.map((condition, cidx) => (
            <InputField
                key={`filter-condition-${service.uuuid}-${cidx}`}
                type="text"
                label={`C${cidx + 1}`}
                value={condition || ''}
                labelPosition="left"
                onChange={(_, { value: condition }) => {
                  const updated = condition ? 
                    conditions.map((c, cci) => cci === cidx ? condition : c) :
                    conditions.filter((c, cci) => cci !== cidx);
                  service.configure({ conditions: updated });
                }}
              />
          ))
       }
       {
          conditions && conditions.length > 1 && (
            <SelectorField 
              label="Op"
              options={{ and: 'and', or: 'or' }}
              value={aggregator}
              onChange={(_ev, { value: aggregator }) => {
                service.configure({ aggregator });
              }}
            />
          )
        }
        <Button
          style={s(t.uc, t.fs12, t.ls1, t.w100)}
          onClick={() => {
            service.configure({ conditions: [ ...conditions, '' ] });
          }}
        >
          Add Condition
        </Button>
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
          { name: 'main', render: this.renderMain }
        ]}
      />
    );
  }
}
/*
class Filter {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.aggregator = 'and';
    this._parsedConditions = [];
    this.conditions = [];
  }

  parseConditions(conditions) {
    const arr = Array.isArray(conditions) ? conditions : [conditions];
    this._parsedConditions = arr.map(cond => parseExpression(cond));
    return arr;
  }

  configure(config) {
    const { 
      conditions,
      aggregator
    } = config;

    if (conditions !== undefined) {
      this.conditions = conditions;
      const arr = this.parseConditions(conditions);
      this.app.notify(this, { conditions: arr });
    }

    if (aggregator !== undefined) {
      this.aggregator = aggregator;
      this.app.notify(this, { aggregator });
    }
  }

  process(params) {
    const filter = x => {
      if (this._parsedConditions.length > 0 && x) {
        const results = this._parsedConditions.map(pc => !!evalExpression(pc, { params: x }))
        switch(this.aggregator) {
          case 'and':
            return !results.some(r => !r);
          case 'or':
            return results.some(r => !!r);
          default:
            console.log(`Unknown filter aggregator: ${this.aggregator}`);
        }
      }
      return false;
    };

    if (Array.isArray(params)) {
      return params.filter(filter);
    }
    
    return filter(params);
  }
}
*/

const descriptor = {
  serviceName: FilterDescriptor.serviceName,
  serviceId: FilterDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new FilterDescriptor.service(app, board, descriptor, id),
    //new Filter(app, board, descriptor, id),
  createUI: FilterUI
};

export default descriptor;
