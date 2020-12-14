import React, { Component } from 'react';
import {
  Icon,
  Menu,
  Sidebar,
  Segment,
  Header,
} from 'semantic-ui-react';

// import Resizable from './Resizable';
import Modal from './Modal';
import ServiceReference from './ServiceReference';
import { s, t } from '../styles';

export default class ServiceFrame extends Component {
  state = {
    menuVisible: false,
    frameCollapsed: false,
    modalReferenceService: undefined,
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
        ev.dataTransfer.setData('text/plain', JSON.stringify(service));
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
    const { modalReferenceService, menuVisible } = this.state;
    const { serviceUi, service } = this.props;
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
            !this.state.frameCollapsed && 
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
