import React, { Component } from 'react';
import { 
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';
import { request } from '../../core/actions';
import { 
  replacePlaceholders,
} from '../../core/url';

const serviceId = 'hookup.to/service/output';
const serviceName = 'Output';

class OutputUI extends Component {
  state = {
    URL: '',
    headers: {}
  };

  onInit = initialState => {
    const { 
      URL='', 
      running=false,
      flow='cancel',
      headers={}
    } = initialState;
    this.setState({ 
      URL, 
      running,
      flow,
      headers
    });
  }

  onNotification = (service, notification) => {
    const {
      URL, 
      running,
      flow,
      headers
    } = notification;
    
    if (URL !== undefined && this.state.URL !== URL) {
      this.setState({ URL });
    }

    if (running !== undefined && this.state.running !== running) {
      this.setState({ running });
    }

    if (flow !== undefined) {
      this.setState({ flow });
    }

    if (headers !== undefined) {
      this.setState({ headers });
    }
  }

  renderMain = service => {
    const { 
      running,
      URL,
      flow, 
      headers
    } = this.state;
    return (
      <div style={t.m10}>
        <div style={s(t.uc, t.ls1, t.fs12)}> 
          <InputField 
            label="URL"
            value={URL}
            onChange={(_, { value }) => {
              this.setState({ URL: value });
              service.configure({ URL: value });
            }}
          />
        </div>
        <SelectorField
          label="flow"
          style={t.mt3}
          options={{
            cancel: 'cancel',
            pass: 'pass-through',
          }}
          value={flow}
          onChange={async (_ev, { value: flow }) => {
            await service.configure({ flow });
            this.setState({ flow });
          }}
        />
        <div style={s(t.tl, t.uc, t.ls1, t.fs12, t.mt3)}>
          <div>Additional Headers</div>
          {
            Object.keys(headers).map(key => (
              <InputField
                key={`output-header-${service.uuid}-${key}`}
                label={key}
                value={headers[key]}
                onChange={async (_, { value: newValue }) => {
                  const newHeaders = {
                    ...this.state.headers,
                    [key]: newValue,
                  };
                  await service.configure({ headers: newHeaders });
                }}
              />
            ))
          }
        </div>
        <div style={s(t.tl, t.mt5)}>
          <Checkbox 
            style={s(t.mt5, t.uc, t.ls1, t.fs12)}
            label="active"
            toggle
            onChange={(_, { checked }) => {
              if (checked) {
                service.configure({ running: true });
              } else {
                service.configure({ running: false });
              }
            }}
            checked={running}
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
    );
  }
}

class Output {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.running = false;
    this.URL = '';
    this.flow = 'cancel';
    this.headers = {};
  }

  configure(config) {
    const { 
      URL,
      running,
      flow,
      headers
    } = config;

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
    }

    if (URL !== undefined) {
      this.URL = replacePlaceholders(URL);
      this.app.notify(this, { URL });
    }

    if (flow !== undefined) {
      this.flow = flow;
      this.app.notify(this, { flow });
    }

    if (headers !== undefined) {
      this.headers = headers;
      this.app.notify(this, { headers });
    }
  }

  process(params) {
    const { 
      URL, 
      running 
    } = this;
    if (URL && running) {
      request(
        { absolute: URL }, 
        'POST', 
        false, 
        params, 
        this.headers
      );
    }

    switch (this.flow) {
      case 'cancel': 
        return null;
      default: 
        return params;
    }
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Output(app, board, descriptor, id),
  createUI: OutputUI
};

export default descriptor;
