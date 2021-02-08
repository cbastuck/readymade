import React, { Component } from 'react';
import { Accordion, Label } from 'semantic-ui-react'

import uuid from 'uuid';

import ServiceUI from './ServiceUI';
import SelectorField from '../../components/shared/SelectorField';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/stack';
const serviceName = 'Stack';
const defaultInput = 'multiplex';
const defaultOutput = 'array';
class StackUI extends Component {
  state = {
    subservices: [],
    input: defaultInput,
    output: defaultOutput,
  };

  onInit = initialState => {
    const { 
      subservices=[],
      input=defaultInput,
      output=defaultOutput,
    } = initialState;
    this.setState({ 
      subservices, 
      input, 
      output,
    });
  }

  onNotification = (service, notification) => {  
    const { 
      subservices,
      input,
      output,
    } = notification;
    if (subservices !== undefined) {
      this.setState({ subservices });
    }

    if (input !== undefined) {
      this.setState({ input });
    }

    if (output !== undefined) {
      this.setState({ output });
    }
  }


  renderMain = service => {
    const { 
      subservices=[],
      output,
      input,
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
    const inputOptions = { multiplex: 'multiplex', lanes: 'lanes' };
    const outputOptions = { array: 'array' };
    return (
      <div>
        <SelectorField
          style={t.mb3}
          label="input"
          options={inputOptions}
          value={input}
          onChange={async (_ev, { value: input }) => {
            await service.configure({ input });
            this.setState({ input });
          }}
        />
        <SelectorField
          style={t.mb3}
          label="output"
          options={outputOptions}
          value={output}
          onChange={async (_ev, { value: output }) => {
            await service.configure({ output });
            this.setState({ output });
          }}
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
    this.input = defaultInput;
    this.output = defaultOutput;
  }

  createSubserviceUI(ssvc) {
    return this.app.createSubServiceUI(ssvc)
  }

  async configure(config) {
    const { 
      services,
      input,
      output,
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

    if (input !== undefined) {
      this.input = input;
      this.app.notify({ input });
    } 

    if (output !== undefined) {
      this.output = output;
      this.app.notify({ output });
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

  async processScalar(params, idx) {
    if (idx !== undefined) {
      const ssvc = this.subservices[idx];
      if (ssvc) {
        return ssvc.process(params);
      }
    } else {
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
  }

  process(params) {
    if (this.subservices.length > 0) {
      if (this.input === 'lanes') {
        if (Array.isArray(params)) {
          return this.processArray(params);
        } else {
          return this.processScalar(params, 0);
        }
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
