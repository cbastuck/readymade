import React, { Component } from 'react';
import { Accordion, Label } from 'semantic-ui-react'

import uuid from 'uuid';

import ServiceUI from './ServiceUI';
import SelectorField from '../../components/shared/SelectorField';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/stack';
const serviceName = 'Stack';

class StackUI extends Component {
  state = {
    subservices: [],
    aggregator: 'array'
  };

  onInit = initialState => {
    const { subservices } = initialState;
    if (subservices) {
      this.setState({ subservices });
    }
  }

  onNotification = (service, notification) => {  
    const { subservices } = notification;
    if (subservices !== undefined) {
      this.setState({ subservices });
    } 
  }


  renderMain = service => {
    const { 
      subservices=[],
      aggregator,
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
  }

  createSubserviceUI(ssvc) {
    return this.app.createServiceUI(ssvc)
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
    } = config;
    if (services !== undefined) {
      const subservices = []
      for (const svc of services) {
        if (!svc.uuid) {
          svc.uuid = uuid.v4();
        }
        const ssvc = await this.app.createService(svc);
        if (ssvc) {
          subservices.push(ssvc);
        }
      }
      this.subservices = subservices;
      this.app.notify({ 
        subservices,
      });
    }
  }

  async process(params) {
    if (this.subservices.length > 0) {
      const results = [];
      for (const ssvc of this.subservices) {
        const r = await ssvc.process(params);
        results.push(r);
      }
      return results;
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
