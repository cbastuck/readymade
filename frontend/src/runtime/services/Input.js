import React, { Component } from 'react';
import { 
  Checkbox,
} from 'semantic-ui-react';

import InputField from '../../components/shared/InputField';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import WebsocketChannel from '../WebsocketChannel';
import { 
  replacePlaceholders, 
  isWebsocket,
  isSecureConnection
} from '../../core/url';

const serviceId = 'hookup.to/service/input';
const serviceName = 'Input';

class InputUI extends Component {
  state = {
    url: '',
    topic: 'secret-key',
    isWebsocket: false
  };

  onInit = initialState => {
    const { 
      url='', 
      running=false,
      topic='secret-key',
      isWebsocket=false
    } = initialState;
    this.setState({url, running, topic, isWebsocket });
  }

  onNotification = (service, notification) => {
    const { 
      url, 
      running,
      topic,
      isWebsocket
    } = notification;
    
    if (url !== undefined && this.state.url !== url) {
      this.setState({ url });
    }

    if (running !== undefined && this.state.running !== running) {
      this.setState({ running });
    }

    if (topic !== undefined) {
      this.setState({ topic });
    }

    if (isWebsocket !== undefined) {
      this.setState({ isWebsocket });
    }
  }

  renderMain = service => {
    const { 
      running,
      url,
      topic,
      isWebsocket
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
            value={url}
            onChange={(_, { value: url }) => {
              this.setState({ url });
              service.configure({ url });
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
            disabled={!isWebsocket}
          />
        </div>
        <div style={t.tl}>
          <Checkbox 
            style={s(t.mt3, t.uc, t.ls1, t.fs12)}
            label="input active"
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

    this.url = '';
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

    const { url, topic } = this;
    if (isWebsocket(url)) {
      this._websocket = new WebsocketChannel(
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
        isSecureConnection()
      );
      await this._websocket.open({ absolute: url });
      this._websocket.send({ topic });
    } else {
      this._eventSource = new EventSource(url);
      this._eventSource.onopen = () => {          
        const listener = this.onEventSourceData.bind(this);
        this._eventSource.onmessage = listener;
        this._eventSource.addEventListener(
          'data',
          listener,
        );
        
        this.closeEventSourceConnection = () => {
          this._eventSource.removeEventListener('data', listener);
          //this.eventSource.removeEventListener('error', onError);
          this._eventSource.close();
          this._eventSource = null;
          this.closeEventSourceConnection = null;
        };
      }
    }
  }

  closeConection() {
    if (this._websocket) {
      this._websocket.close();
      this._websocket = null;
    }

    if (this.closeEventSourceConnection) {
      this.closeEventSourceConnection();
    }
  }

  async configure(config) {
    const { 
      url,
      running,
      topic,
    } = config;

    let reconnet = false;
    if (topic !== undefined) {
      this.topic = topic;
      reconnet = true;
    }

    if (url !== undefined && url) {
      this.url = replacePlaceholders(url);
      reconnet = true;
      this.app.notify(this, { url });
    }

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
    }

    if (reconnet) {
      this.doConnect();
      this.isWebsocket = !!this._websocket;
      this.app.notify(this, { isWebsocket: this.isWebsocket })
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
