import React, { Component } from 'react';
import { TextArea, Checkbox } from 'semantic-ui-react';

import MonitorDescriptor from 'services/Monitor';

import { s, t } from '../../styles';
import ServiceUI from './ServiceUI';

function isObject(obj) {
  return typeof obj === 'object' && obj !== null;
}

function unroll(params) {
  const isBlob = params instanceof Blob;
  if (isBlob) {
    return `Blob (${params.type} ${params.size} bytes)`;
  }
  const isPrimitive = !isObject(params);
  if (isPrimitive) {
    return params;
  }
  const isArray = Array.isArray(params);
  if (isArray) {
    return params.map(x => unroll(x));
  }
  return Object.keys(params).reduce(
    (all, key) => ({
      ...all,
      [key]: unroll(params[key])
    }),
    {}
  );
}

class MonitorUI extends Component {
  state = {
    message: '',
  };

  onInit = initialState => {
    this.setState({ 
      ...initialState, 
      message: '',
    });
  }

  onNotification = (service, params) => {
    const s = unroll(params);
    this.setState({ 
      message: isObject(s) ?
        JSON.stringify(s, null, 2) :
        s 
    });
  }

  render() {
    const { 
      message,
      enabled 
    } = this.state;
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
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >        
              <TextArea
                style={{
                  margin: 10,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  resize: 'none',
                  border: '1px solid lightgray',
                  borderRadius: 5,
                  flexGrow: 1
                }}
                value={message}
              />
              <div 
                style={{ 
                  marginBottom: 10,
                  marginLeft: 10,
                  textAlign: 'left' 
                }}
              >
                <Checkbox
                  style={s(t.uc, t.fs12, t.m(0, 3))}
                  label="active"
                  checked={enabled}
                  toggle
                  onChange={(_, { checked: enabled }) => 
                    this.setState(
                      { enabled }, 
                      () => service.configure({ enabled })
                    )
                  }
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