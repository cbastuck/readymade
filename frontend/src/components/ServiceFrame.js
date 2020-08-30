import React, { Component } from 'react';
import {
  Icon,
  Menu,
  Sidebar,
  Segment,
  Header,
} from 'semantic-ui-react';

import './ServiceFrame.css';

export default class ServiceFrame extends Component {
  state = {
    mouseOver: false,
    menuVisible: false,
    frameCollapsed: false,
  };

  renderServiceName = name => (
    <div 
      style={{
        textAlign: 'center',
        width: '100%',
        fontSize: 16,
        fontWeight: 'lighter',
        marginTop: 15,
        marginLeft: 50,
      }}
      onDoubleClick={() => this.setState({ frameCollapsed: !this.state.frameCollapsed })}
    >
      <Header size='small'>
        <span 
          style={{
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {name}
        </span>
      </Header>
    </div>
  )

  renderHeader = service => {
    return (
      <Menu
        borderless={true}
        style={{
          boxShadow: 'none',
          border: 'none',
          margin: 0,
        }}
      >
        { this.renderServiceName(service.props.service.serviceName) }
        <Menu.Item
          position="right"
          onClick={() => this.setState({ 
            menuVisible: !this.state.menuVisible,
            frameCollapsed: this.state.frameCollapsed && !this.state.menuVisible,
          })}
        >
          <Icon 
            name='bars' 
            style={{ color: '#ddd', margin: 5, }}
          />
        </Menu.Item>
      </Menu>
    )
  }

  renderMenu = () => {
    const itemStyle = { 
      height: 40,
    };
    return (
      <Menu
        vertical
        compact
        style={{ minHeight: '100%' }}
      >
        <Menu.Item
          as='a'
          onClick={() => 
            this.setState({ 
              frameCollapsed: !this.state.frameCollapsed 
            })
          }
          style={itemStyle}
        >
          <Icon name='compress' />
        </Menu.Item>
        <Menu.Item
          as='a'
          style={itemStyle}
        >
          <Icon name='clone outline' />
        </Menu.Item>
        <Menu.Item 
          as='a'
          style={itemStyle}
          onClick={() => {
            const { onAction, service } = this.props;
            if (onAction) {
              onAction({ 
                action: 'remove', 
                service: service.props.service,
              });
            }
          }}
        >
          <Icon name='trash alternate outline' />
        </Menu.Item>
      </Menu> 
    );
  }

  renderService = service => service;

  render() {
    const { service } = this.props;
    const uuid = service && service.props && service.props.service && service.props.service.uuid;
    return (
      <div key={`service-frame-${uuid}`}>
        <div
          className='unselectable'
          style={{
            border: 'solid 1px lightgray',
            borderRadius: 5,
            textAlign: 'center',
            backgroundColor: 'white',
            top: '18%',
            margin: 10,
            fontSize: 15,
            color: 'black'
          }}
          onMouseOver={() => this.setState({ mouseOver: true })}
          onMouseOut={() => this.setState({ mouseOver: false })}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            {
              this.renderHeader(service)
            }
            {
              !this.state.frameCollapsed && (
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
                    direction='right'
                    width='very thin'
                    visible={this.state.menuVisible}
                    style={{ 
                      overflowX: 'hidden',
                      boxShadow: '0 0 2px rgba(34,36,38,.15)',
                    }}
                  >
                    { this.renderMenu() }
                  </Sidebar>
                  { this.renderService(service) } 
                </Sidebar.Pushable>
              )
            }
          </div>
        </div>
      </div>
    );
  }
}
