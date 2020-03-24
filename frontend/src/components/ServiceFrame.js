import React, { Component } from 'react';
import {
  Icon,
  Menu,
  Sidebar,
  Segment,
} from 'semantic-ui-react';

import './ServiceFrame.css';

export default class ServiceFrame extends Component {
  state = {
    mouseOver: false,
    menuVisible: false,
  };

  renderHeader = service => (
    <Menu
      borderless={true}
      style={{ 
        boxShadow: 'none', 
        border: 'none', 
        borderBottom: 'solid 1px lightgray', 
        borderRadius: 0 
      }}
    >
      <div 
        style={{ 
          textAlign: 'center',
          width: '100%',
          fontSize: 16,
          marginTop: 10,
        }}
      >    
        { service.props.service.serviceName }
      </div>
      <Menu.Item
        position="right"
        onClick={() => this.setState({ menuVisible: !this.state.menuVisible })}
      >
        <Icon 
          name='bars' 
          style={{ color: '#ddd' }}
        />
      </Menu.Item>
    </Menu>
  )

  renderMenu = () => {
    const itemStyle = { 
      height: 40,
      
    };
    return (
      <Menu
        vertical
        compact
        style={{ height: '100%' }}
      >
        <Menu.Item 
          as="a"
          onClick={this.onTrashIcon}
          style={itemStyle}
        >
          <Icon
            name='trash alternate outline'
          />
        </Menu.Item>

        <Menu.Item
          as="a"
          onClick={this.handleItemClick}
          style={itemStyle}
        >
          <Icon 
            name='clone outline'
          />
        </Menu.Item>

        <Menu.Item
          as="a"
          style={itemStyle}
        >
          <Icon 
            name='compress'
          />
        </Menu.Item>
      </Menu> 
    );
  }

  renderService = service => service;

  render() {
    const { service } = this.props;    
    return (
      <div key={`service-frame-${service.uuid}`}>
        <div
          className="unselectable"
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
             <Sidebar.Pushable 
              as={Segment}
              style={{
                transform: 'none',
              }}
            >
              <Sidebar
                animation='overlay'
                direction='right'
                width='very thin'
                visible={this.state.menuVisible}
              >
                { this.renderMenu() }
              </Sidebar>
              <Sidebar.Pusher 
                // dimmed={this.state.menuVisible}
              >
                <Segment basic>
                  { this.renderService(service) }
                </Segment>
              </Sidebar.Pusher>
             </Sidebar.Pushable>
          </div>
        </div>
      </div>
    );
  }
}
