import React, { Component } from 'react';
import { 
  Input as InputField, 
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/input';
const serviceName = 'Input';

class InputUI extends Component {
  state = {
    eventSourceURL: '',
  };

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  onNotification = (service, notification) => {
    const { 
      eventSourceURL, 
      running 
    } = notification;
    
    if (eventSourceURL !== undefined && 
        this.state.eventSourceURL !== eventSourceURL) {
      this.setState({ eventSourceURL });
    }

    if (running !== undefined && 
        this.state.running !== running) {
      this.setState({ running });
    }
  }

  renderEventSourceTab = service => {
    const { 
      running,
      eventSourceURL,
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
            value={eventSourceURL}
            onChange={(_, { value }) => {
              this.setState({ eventSourceURL: value });
              service.configure({ eventSourceURL: value });
            }}
          />
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

  renderBoardTab = () => {
    return <div />;
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit}
        onNotification={this.onNotification}
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
    this.running = false;
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

  configure(config) {
    const { 
      eventSourceURL,
      running,
    } = config;
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

        this.app.notify(this, { eventSourceURL });
      };
    }

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
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
