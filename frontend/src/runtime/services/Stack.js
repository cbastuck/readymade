import React, { Component } from 'react';
import { Accordion, Label, Checkbox } from 'semantic-ui-react'

import uuid from 'uuid';

import ServiceUI from './ServiceUI';
import SelectorField from '../../components/shared/SelectorField';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/stack';
const serviceName = 'Stack';

class StackUI extends Component {
  state = {
    subservices: [],
    aggregator: 'array',
    multiplexInput: false,
  };

  onInit = initialState => {
    const { 
      subservices=[],
      multiplexInput=false,
    } = initialState;
    this.setState({ 
      subservices, 
      multiplexInput 
    });
  }

  onNotification = (service, notification) => {  
    const { 
      subservices,
      multiplexInput,
    } = notification;
    if (subservices !== undefined) {
      this.setState({ subservices });
    }

    if (multiplexInput !== undefined) {
      this.setState({ multiplexInput });
    }
  }


  renderMain = service => {
    const { 
      subservices=[],
      aggregator,
      multiplexInput,
    } = this.state;

    const rootPanels = subservices.map((ssvc, idx) => ({
      title: {
        children: (
        <div style={s(t.uc, t.fs12, t.ls1)}>
          {ssvc.__descriptor.serviceName}
        </div>
        )
      },
      key: ssvc.uuid,
      content: { content: service.createSubserviceUI(ssvc) }, // only possible in BrowserRuntime?
    }));
    const options = { [aggregator]: aggregator };
    return (
      <div>
        <SelectorField
          style={t.mb3}
          label="aggregator"
          options={options}
          value={aggregator}
          onChange={async (_ev, { value }) => {}
          }
        />
        <div style={s(t.tl, t.m(0, 5) , t.uc, t.ls1, t.fs10)}>
          <Checkbox 
            toggle
            label="Multiplex Input"
            checked={multiplexInput}
            onChange={(_, { checked }) => {
              service.configure({ multiplexInput: checked });
            }}
          />
        </div>
        <div style={t.tl}>
          <Label
            style={s(t.uc, t.fs11, t.ls1, { borderRadius: 0, padding: 10 })}
          >
            Services
          </Label>
          <Accordion
            style={t.tc}
            defaultActiveIndex={0} 
            panels={rootPanels} 
            fluid 
            styled 
          />  
        </div>
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

class Stack {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.subservices = [];
    this.multiplexInput = false;
  }

  createSubserviceUI(ssvc) {
    return this.app.createSubServiceUI(ssvc)
  }

  async destroy() {
    for (const svc of this.subservices) {
      if (svc.destroy) {
        await svc.destroy();
      }
    }
  }

  async configure(config) {
    const { 
      services,
      multiplexInput,
    } = config;
    if (services !== undefined) {
      const subservices = []
      for (const svc of services) {
        if (!svc.uuid) {
          svc.uuid = uuid.v4();
        }
        const ssvc = await this.app.createSubService(this, svc);
        if (ssvc) {
          subservices.push(ssvc);
        }
      }
      this.subservices = subservices;
      this.app.notify({ 
        subservices,
      });
    }

    if (multiplexInput !== undefined) {
      this.multiplexInput = multiplexInput;
      this.app.notify({ 
        multiplexInput,
      });
    } 
  }

  async processArray(params) {
    const results = await Promise.all(
      this.subservices.map((ssvc, idx) => 
        ssvc.process(params[idx])
      )
    );
    const notNull = results.some(r => r !== null);
    return notNull ? results : null;
  }

  async processScalar(params) {
    const results = [];
    let allNull = true;
    for (const ssvc of this.subservices) {
      const r = await ssvc.process(params);
      if (r !== null) {
        allNull = false;
      }
      results.push(r);
    }
    return allNull ? null : results;
  }

  process(params) {
    if (this.subservices.length > 0) {
      if (Array.isArray(params)) {
        return this.processArray(params);
      }
      return this.processScalar(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Stack(app, board, descriptor, id),
  createUI: StackUI,
};

export default descriptor;
