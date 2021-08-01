import React, { Component } from 'react';
import { 
  Menu,
  Segment,
} from 'semantic-ui-react';

import { s } from '../../styles';
import { BoardConsumer } from '../../BoardContext';
import Resizable from '../../components/Resizable';

function getNotificationID(service) {
  return `service-ui-${service.uuid}`;
}

class Notifications {
  constructor() {
    this.callbacks = {};
  }

  register(id, callback) {
    this.callbacks[id] = callback;
  }

  unregister(id) {
    delete this.callbacks[id];
  }

  notify(service, notification) {
    for (const id in this.callbacks) {
      this.callbacks[id](service, notification);
    }
  }
}

export default class ServiceUI extends Component {
  state = {
    currentSegmentName: undefined,
  };

  constructor(props) {
    super(props);
    const { service, initialSegment } = props;
    service.__notificationTargets = new Notifications();

    if (initialSegment) {
      this.state.currentSegmentName = initialSegment(service);
    }
  } 

  componentWillUnmount() {
    const { service } = this.props;
    service.__notificationTargets.unregister(getNotificationID(service));

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setup = (boardContext, { runtimeId, service: backendService, onTimer, onInit, onNotification }) => {
    const { service } = this.props;
    if (!this.service) {
      if (service) {
        this.service = service;
        if (onInit) {
          setTimeout(() => onInit(service), 0);
        }
        if (onTimer) {
          this.timer = setInterval(() => onTimer(service), 1000);
        }
        if (onNotification) {
          service.__notificationTargets.register(getNotificationID(service), onNotification);
        }
      }      
    }
    return this.service;
  }

  getCurrentSegmentName = () => {
    const { 
      segments,
    } = this.props;
    const { currentSegmentName } = this.state;
    if (currentSegmentName) {
      return currentSegmentName;
    }
    
    for (const segment of segments) {
      if (segment && !segment.disabled) {
        return segment.name;
      }
    } 
  }

  renderSegments = ({ service }, segments, resizable) => {
    if (!service) {
      return false;
    }
    const currentSegmentName = this.getCurrentSegmentName();
    const segment = segments.find(segment => segment.name === currentSegmentName);
    return (
      <Resizable hideHandle={!resizable}>
        {
          segments.length > 1 && (
            <Menu 
              compact 
              pointing 
              style={{
                marginTop: 10, 
                overflow: 'hidden',
              }}
            >
            { 
              segments.map(
                (segment, idx) => 
                  <Menu.Item
                    key={`${service.uuid}-${segment.name}-${idx}`}
                    name={segment.name}
                    active={currentSegmentName === segment.name}
                    onClick={(_, { name: currentSegmentName }) => this.setState({ currentSegmentName })}
                    style={{ 
                      textTransform: 'uppercase',
                      fontSize: 11,
                      letterSpacing: 1,
                    }}
                    disabled={segment.disabled}
                  />
              )
            }
            </Menu>
          )
        }
        <div>
          <Segment style={{ margin: '15px 20px', padding: 0, height: '100%' }}>
            <div style={s({ padding: 14, height: '100%' })}>
              { segment && segment.render(service) }
            </div>
          </Segment>
        </div>
      </Resizable>
    );
  }

  renderSingleSegment = (boardContext, children, resizable) => {
    const { setup } = this.props;
    const c = children({ 
      boardContext,
      service: setup ? setup(boardContext, this.props) : this.setup(boardContext, this.props)
    });
    return resizable ? 
      <Resizable> { c } </Resizable> : 
      c;
  }

  render() {
    const { 
      children, 
      segments, 
      setup,
      resizable=true,
    } = this.props;
    return (
      <BoardConsumer>
        {
          boardContext => 
            segments ? 
              this.renderSegments(
                { 
                  boardContext, 
                  service: setup ? setup(boardContext, this.props) : this.setup(boardContext, this.props),
                }, 
                segments,
                resizable
              ) : 
              this.renderSingleSegment(boardContext, children, resizable)
        }
      </BoardConsumer>
   ); 
  }
}