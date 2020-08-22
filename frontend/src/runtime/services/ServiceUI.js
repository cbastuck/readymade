import React, { Component } from 'react';
import { 
  Menu,
  Segment,
} from 'semantic-ui-react';

import { BoardConsumer } from '../../BoardContext';

export default class ServiceUI extends Component {
  state = {
    currentSegmentName: undefined,
  };

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setup = (boardContext, { runtimeId, service: backendService, onTimer, onInit }) => {
    if (!this.service) {
      const runtime = boardContext && boardContext.getCurrentBrowserRuntime(runtimeId);
      const service = runtime && runtime.getServiceById(backendService.uuid);
      this.service = service;
      if (onInit) {
        setTimeout(() => onInit(service), 0);
      }
      if (onTimer) {
        this.timer = setInterval(() => onTimer(service), 1000);
      }
    }
    return this.service;
  }

  getCurrentSegmentName = () => {
    if (this.state.currentSegmentName) {
      return this.state.currentSegmentName;
    }
    if (this.props.initialSegment) {
      return this.props.initialSegment();
    }
    return this.props.segments && 
      this.props.segments[0] && 
      this.props.segments[0].name
  }

  renderSegments = ({ service }, segments) => {
    const currentSegmentName = this.getCurrentSegmentName();
    const segment = segments.find(segment => segment.name === currentSegmentName);
    const marginStyle = { margin: '5px 5px' };
    return (
      <div style={marginStyle}>
        {
          segments.length > 1 && (
            <Menu 
              compact 
              pointing 
              style={{  marginTop: 10 }}
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
                  />
              )
            }
            </Menu>
          )
        }
        <Segment 
          style={{ margin: '15px 20px' }}
        >
          { segment && segment.render(service) }
        </Segment>
      </div>
    );
  }

  render() {
    const { children, segments } = this.props;
    return (
      <BoardConsumer>
        {
          boardContext => 
            segments ? 
              this.renderSegments(
                { 
                  boardContext, 
                  service: this.setup(boardContext, this.props),
                }, 
                segments
              ) : 
              children({ 
                boardContext,
                service: this.setup(boardContext, this.props)
              })
        }
      </BoardConsumer>
   ); 
  }
}