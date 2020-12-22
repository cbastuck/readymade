import React, { Component } from 'react';
import { TextArea, Checkbox } from 'semantic-ui-react';

import MonitorDescriptor from 'services/Monitor';

import { s, t } from '../../styles';
import ServiceUI from './ServiceUI';

class MonitorUI extends Component {
  state = {
    message: ''
  };

  onInit = initialState => {
    this.setState({ ...initialState, message: '' });
  }

  onNotification = (service, params) => {
    this.setState({
      message: JSON.stringify(params, null, 2),
    });
  }

  render() {
    return (
      <ServiceUI 
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {
          ({ service }) => service && (
            <div
              style={{
                textAlign: 'left',
                margin: 10,
              }}
            >        
              <TextArea
                style={{ 
                  width: '100%', 
                  minHeight: 150, 
                  minWidth: 200,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                }}
                value={this.state.message}
              />
              <div>
                <Checkbox
                  style={s(t.uc, t.fs12, t.m(0, 3))}
                  label="active"
                  checked={this.state.enabled}
                  onChange={(_, { checked: enabled }) => 
                    this.setState(
                      { enabled }, 
                      () => service.configure({ enabled })
                    )
                  }
                  toggle
                />
              </div>
            </div> 
          )
        }
      </ServiceUI>
    );
  }
}

const { serviceName, serviceId, service: Monitor } = MonitorDescriptor;
const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Monitor(app, board, descriptor, id),
  createUI: MonitorUI
};

export default descriptor;
