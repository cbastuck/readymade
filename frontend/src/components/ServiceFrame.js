import React, { Component } from 'react';
import {
  Icon,
  Menu,
  Sidebar,
  Segment,
  Header,
} from 'semantic-ui-react';

import Modal from './Modal';
import ServiceReference from './ServiceReference';
import ConfigurationEditor from './ConfigurationEditor';
import { s, t } from '../styles';
import { filterPrivateMembers } from '../runtime/services/helpers';

export default class ServiceFrame extends Component {
  state = {
    menuVisible: false,
    frameCollapsed: false,
    modalReferenceService: undefined,
    configVisible: false,
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
      draggable
      onDragStart={ev => {
        const { service } = this.props;
        const publicService = filterPrivateMembers(service);
        ev.dataTransfer.setData('text/plain', JSON.stringify(publicService));
      }}
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
        { 
          this.renderServiceName(
            service.__descriptor ? 
              service.__descriptor.serviceName : 
              service.serviceName 
          ) 
        }
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
              frameCollapsed: !this.state.frameCollapsed,
              menuVisible: false
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
                service,
              });
            }
            this.setState({ menuVisible: false });
          }}
        >
          <Icon name='trash alternate outline' />
        </Menu.Item>
        <Menu.Item 
          as='a'
          style={itemStyle}
          onClick={() => {
            const { service } = this.props;
            const serviceId = service.serviceId || service.__descriptor.serviceId;
            const parts = serviceId.split('/');
            this.setState({ 
              modalReferenceService: parts[parts.length - 1],
              menuVisible: false
            });
          }}
        >
          <Icon name='help' />
        </Menu.Item>
        <Menu.Item 
          as='a'
          style={itemStyle}
          onClick={() => {
            this.setState({ 
              configVisible: true,
              menuVisible: false,
            });
          }}
        >
          <Icon name='cogs' />
        </Menu.Item>
      </Menu> 
    );
  }

  renderServiceWithSidebar = (serviceUi, menuVisible) => {
    return (
      <div
        style={{
          position: 'relative',
        }}
      >
        {
          menuVisible && (
            <div 
              style={{
                position: 'absolute',
                height: '100%',
                width: '100%',
                backgroundColor: 'white',
                opacity: 0.8,
                zIndex: 2000001,
              }}
              onClick={() => this.setState({ menuVisible: false })}
            />
          )
        }
        { serviceUi } 
        {
          menuVisible && (
            <div
              style={{
                position: 'absolute',
                height: '100%',
                width: 59,
                right: 0,
                top: 0,
                overflowY: 'auto',
                zIndex: 2000002
              }}
            >
              { this.renderMenu() }
            </div>
          )
        }
      </div>
    );
  }

  renderServiceWithSidebarOld = (serviceUi, menuVisible) => {
    return (
      <Sidebar.Pushable as={Segment.Group} raised
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
          visible={menuVisible}
          style={{ 
            overflowX: 'hidden',
            boxShadow: '0 0 2px rgba(34,36,38,.15)',
          }}
        >
          { this.renderMenu() }
        </Sidebar>
        { serviceUi } 
      </Sidebar.Pushable>
    )
  }

  render() {
    const {
      frameCollapsed,
      modalReferenceService, 
      menuVisible, 
      configVisible 
    } = this.state;
    const { 
      serviceUi, 
      service,
    } = this.props;
    const uuid = service && service.uuid;
    return (
      <div key={`service-frame-${uuid}`}>
        <div
          style={
            s(t.unselectable, {
              border: 'solid 1px lightgray',
              borderRadius: 5,
              textAlign: 'center',
              backgroundColor: 'white',
              margin: '10px 0px',
              fontSize: 15,
              color: 'black',
            })
          }
        >
          {
            this.renderHeader(service)
          }
          {
            !frameCollapsed && 
            configVisible && (
              <ConfigurationEditor 
                service={service} 
                onClose={() => this.setState({ configVisible: false })}
                onChange={async value => {
                  try {
                    const config = JSON.parse(value);
                    await service.configure(config); // TODO: not here
                    this.setState({ configVisible: false });
                  } catch (err) {
                    
                  }
                }}
              />
            )
          }
          {
            !configVisible &&
            !frameCollapsed &&
            this.renderServiceWithSidebar(serviceUi, menuVisible)
          }
          <Modal
            title="Service Documentation"
            component={<ServiceReference service={modalReferenceService} />}
            url={`/service/${modalReferenceService}`}
            setOpen={open => !open && this.setState({ modalReferenceService: undefined })}
            isOpen={!!modalReferenceService}
          />
        </div>
      </div>
    );
  }
}
