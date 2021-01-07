import React, { Component } from 'react';
import { 
  Input as InputField, 
  Checkbox,
  Button,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/browser/input';
const serviceName = 'Input';

class InputUI extends Component {
  state = {
    eventSourceURL: '',
  };

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  onTimer = service => {
    const { eventSourceURL } = service;
    if (this.state.eventSourceURL !== eventSourceURL) {
      this.setState({ eventSourceURL });
    }
  }

  renderEventSourceTab = service => {
    return (
      <div
        style={{
          margin: 10,
        }}
      >       
        <div style={s(t.uc, t.ls1, t.fs12)}> 
          <InputField 
            label="URL"
            value={this.state.eventSourceURL}
            onChange={(_, { value }) => this.setState({ eventSourceURL: value })}
          />
        </div>
        <div style={t.mt5}>
          <Button 
            style={s(t.uc, t.ls1, t.w100, t.fs12)}
            disabled={!this.state.eventSourceURL}
            onClick={() => service.configure({ eventSourceURL: this.state.eventSourceURL })}
          >
            Connect
          </Button>
        </div>
        <div style={t.tl}>
          <Checkbox 
            style={s(t.mt5, t.uc, t.ls1, t.fs12)}
            label="active"
            toggle
          />
        </div>
      </div>
    );
  }

  renderBoardTab = () => {
    return <div />;
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onTimer={this.onTimer.bind(this)}
        segments={[
          { name: 'Event Source', render: this.renderEventSourceTab },
          // { name: 'Board', render: this.renderBoardTab }
        ]}
      />
    );
  }
}

class Input {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.parseEventsAsJSON = true;
  }

  onEventSourceData(event) {
    const { data } = event;
    if (data) {
      const params = (this.parseEventsAsJSON) ? 
        JSON.parse(data) :
        { raw: data };
      this.app.next(this, params);
    }
  }

  configure(config) {
    const { eventSourceURL } = config;
    if (eventSourceURL !== undefined) {
      this.eventSource = new EventSource(eventSourceURL);
      this.eventSource.onopen = () => {
        this.eventSourceURL = eventSourceURL;
        
        const listener = this.onEventSourceData.bind(this);
        this.eventSource.onmessage = listener;
        this.eventSource.addEventListener(
          'data',
          listener,
        );
        
        this.closeEventSourceConnection = () => {
          this.eventSource.removeEventListener('data', listener);
          //this.eventSource.removeEventListener('error', onError);
          this.eventSource.close();
          this.eventSource = null;
          this.closeEventSourceConnection = null;
        };
      };
    }
  }

  destroy() {
    if (this.closeEventSourceConnection) {
      this.closeEventSourceConnection();
    }
  }

  process(params) {
    return params;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Input(app, board, descriptor, id),
  createUI: InputUI
};

export default descriptor;
