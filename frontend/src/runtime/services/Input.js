import React, { Component } from 'react';
import { 
  Checkbox,
} from 'semantic-ui-react';

import InputField from '../../components/shared/InputField';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import WebsocketChannel from '../WebsocketChannel';

const serviceId = 'hookup.to/service/input';
const serviceName = 'Input';

class InputUI extends Component {
  state = {
    URL: '',
    topic: 'secret-key'
  };

  onInit = initialState => {
    const { 
      URL='', 
      running=false,
      topic='secret-key',
    } = initialState;
    this.setState({ URL, running, topic });
  }

  onNotification = (service, notification) => {
    const { 
      URL, 
      running,
      topic
    } = notification;
    
    if (URL !== undefined && this.state.URL !== URL) {
      this.setState({ URL });
    }

    if (running !== undefined && this.state.running !== running) {
      this.setState({ running });
    }

    if (topic !== undefined) {
      this.setState({ topic });
    }
  }

  renderMain = service => {
    const { 
      running,
      URL,
      topic
    } = this.state;
    return (
      <div
        style={{
          margin: 10,
        }}
      >       
        <div style={s(t.uc, t.ls1, t.fs12)}> 
          <InputField 
            label="URL"
            value={URL}
            onChange={(_, { value: URL }) => {
              this.setState({ URL });
              service.configure({ URL });
            }}
          />
        </div>
        <div style={s(t.uc, t.ls1, t.fs12)}> 
          <InputField 
            label="topic"
            value={topic}
            onChange={(_, { value: topic }) => {
              this.setState({ topic });
              service.configure({ topic });
            }}
          />
        </div>
        <div style={s(t.tl, t.mt5)}>
          <Checkbox 
            style={s(t.mt5, t.uc, t.ls1, t.fs12)}
            label="active"
            toggle
            onChange={(_, { checked: running }) => {
              service.configure({ running });
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

class Input {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.URL = '';
    this.parseEventsAsJSON = true;
    this.running = false;
    this.topic = 'secret-key';
  }

  onEventSourceData(event) {
    if (this.running) {
      const { data } = event;
      if (data) {
        const params = (this.parseEventsAsJSON) ? 
          JSON.parse(data) :
          { raw: data };
        this.app.next(this, params);
      }
    }
  }

  async doConnect() {
    this.closeConection();

    const { protocol } = window.location;
    const { URL, topic } = this;
    const secureConnection = protocol.indexOf('https') === 0;
    if (URL.startsWith('ws://' || URL.startsWith('wss://'))) {
      this.websocket = new WebsocketChannel(
        `input-service-${this.uuid}`,
        params => {
          if (this.running) {
            const { action } = params;
            if (action === 'ping') {
              return;
            }
            this.app.next(this, params);
          }
        },
        secureConnection
      );
      await this.websocket.open({ absolute: URL });
      this.websocket.send({ topic });
    } else {
      this.eventSource = new EventSource(URL);
      this.eventSource.onopen = () => {          
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
      }
    }
  }

  closeConection() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.closeEventSourceConnection) {
      this.closeEventSourceConnection();
    }
  }

  async configure(config) {
    const { 
      URL,
      running,
      topic,
    } = config;

    let reconnet = false;
    if (topic !== undefined) {
      this.topic = topic;
      reconnet = true;
    }

    if (URL !== undefined && URL) {
      this.URL = URL;
      reconnet = true;
      this.app.notify(this, { URL });
    }

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
    }

    if (reconnet) {
      this.doConnect();
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
