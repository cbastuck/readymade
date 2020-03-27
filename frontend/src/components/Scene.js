import React, { Component } from 'react';
import { 
  Icon,
  Sidebar,
  Segment,
  Menu,
} from 'semantic-ui-react';

import ServiceFrame from './ServiceFrame';

export default class Scene extends Component {
  state = {
    expanded: false,
    readonly: false,
    showSettings: false,
    wrapServices: false,
  };

  componentDidMount() {
    const { readonly } = this.props;
    this.setState({
      expanded: !readonly,
      readonly: readonly
    });
  }

  componentWillReceiveProps(nextProps) {
    if (this.state.readonly !== nextProps.readonly) {
      this.setState({ 
        expanded: !nextProps.readonly,
        readonly: nextProps.readonly
      });
    }
  }

  renderExpandableHeadline(headline) {    
    return (
      <h4>
        <div 
          style={{ 
            marginTop: 5,
            marginLeft: 5,
          }}
        >
          <Icon 
            name="bars"
            style={{ margin: '10px 18px', cursor: 'pointer', color: '#ddd' }}
            onClick={() => this.setState({ 
              showSettings: !this.state.showSettings,
              expanded: !this.state.expanded ? !this.state.showSettings : this.state.expanded
            })}
          />
          <span> 
            {headline} 
          </span> 
        </div>
      </h4>
    );
  }

  renderSettings = () => {
    const itemStyle = { 
      height: 40,
      margin: 0,
    };
    return (
      <Menu
        vertical
        compact
        style={{ height: '100%' }}
      >
        <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => this.setState({
            expanded: !this.state.expanded,
            showSettings: this.state.showSettings && !this.state.expanded
          })}
        >
          <Icon name='compress' />
        </Menu.Item>
        <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => this.setState({ wrapServices: !this.state.wrapServices })}
        >
          <Icon 
            name={ this.state.wrapServices ? 'exchange' : 'sort amount down' }
          />
        </Menu.Item>
        <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => {}}
        >
          <Icon name='keyboard' />
        </Menu.Item>
      </Menu>
    );
  }
    
  render() {
    const { children, runtime, style, readonly=false, frameless=false } = this.props;
    const { wrapServices } = this.state;
    const readonlyStyle = (readonly && !frameless) ? 
      {
        backgroundColor: '#FFFFFF',
        opacity: 0.3,
        width: '100%',
        zIndex: 200000,
        cursor: 'not-allowed',
        display: !this.state.expanded && 'none'
      } :
      {};

    return (
      <div
        style={{
          border: !frameless && 'solid 1px lightgray',
          borderRadius: 3,
          backgroundColor: !frameless && '#EEEEEE10',
          ...style,
        }}
      >
        {
          !frameless && this.renderExpandableHeadline(runtime)
        }
         <Sidebar.Pushable 
          as={Segment}
          style={{
            border: 'none',
            boxShadow: 'none',
            margin: 0,
            // Workaround: https://github.com/Semantic-Org/Semantic-UI-React/issues/2897
            // without it, the fullscreen is not working, eg. canvas service
            transform: 'none',
          }}
        >
          <Sidebar
            animation='overlay'
            direction='left'
            width='very thin'
            visible={this.state.showSettings}
            style={{ 
              overflowX: 'hidden',
              boxShadow: '0 0 2px rgba(34,36,38,.15)',
            }}
          >
            { this.renderSettings() }
          </Sidebar>
          <div
            style={{
              display: 'flex',
              flexFlow: wrapServices ? 'row wrap' : 'row nowrap',
              overflow: 'auto',
              padding: 10,
              ...readonlyStyle
            }}
            onClickCapture={e => readonly && e.stopPropagation()}
          >
          {
            this.state.expanded && 
            children && 
            children.map(
              service => {
                return (
                  <ServiceFrame
                    key={`scene-frame-${service.props.service.uuid}`}
                    service={service}
                  />
                )
              }
            )
          }
          </div>
        </Sidebar.Pushable>
      </div>
    );
  }
}
