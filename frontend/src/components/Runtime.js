import React, { Component } from 'react';
import { 
  Icon,
  Sidebar,
  Segment,
  Menu,
  Dropdown,
} from 'semantic-ui-react';

import { openTab, getServiceConfiguration } from '../core/actions';
import RemoteRuntime from '../runtime/RemoteRuntime';
import BrowserRuntime from '../runtime/BrowserRuntime';

import { t } from '../styles';

import './Runtime.css';

export default class Runtime extends Component {
  state = {
    expanded: false,
    readonly: false,
    showSettings: false,
    wrapServices: undefined,
  };

  componentDidMount() {
    const { readonly } = this.props;
    this.setState({
      expanded: !readonly,
      readonly: readonly
    });
  }

  componentDidUpdate(prevProps) {
    const { readonly } = this.props;
    if (readonly !== prevProps.readonly) {
      this.setState({ 
        expanded: !readonly,
        readonly: readonly
      });
    }
  }

  onAddService(service) {
    const { 
      boardContext, 
      runtime, 
      runtimeId,
    } = this.props;
    const id = runtimeId || (runtime && runtime.id);
    if (boardContext) {
      boardContext.addService(service, id);
    }
  }

  onServiceAction = (command) => {
    const { boardContext, runtime } = this.props;
    const { service, action } = command;
    switch (action) {
      case 'remove': {
        if (boardContext && runtime && service) {
          return boardContext.removeService(runtime, service);
        }
        break;
      }
      case 'help': {
        const serviceId = service.serviceId || service.__descriptor.serviceId;
        const parts = serviceId.split('/');
        openTab(`/service/${parts[parts.length - 1]}`);
        break;
      }
      case 'getConfig': {
        return getServiceConfiguration(boardContext.boardName, service, runtime);
      }
      default: 
        console.log('Scene processing unknown service action', action);
    }
  }

  getServiceById = serviceUuid => {
    const { boardContext, runtime } = this.props;
    const services = boardContext.services[runtime.id];  
    return (this.impl && this.impl.getServiceById) ? 
      this.impl.getServiceById(serviceUuid) : 
      services.find(svc => svc.uuid === serviceUuid);
  }

  processRuntime = params => {
    // TODO: does this make sense for browser runtimes only?
    this.impl.processRuntime && this.impl.processRuntime(params);
  }

  processService = (serviceUuid, params) => {
    const service = this.getServiceById(serviceUuid);
    if (service) {
      service.process(params);
    } else {
      console.error('Process service failed', serviceUuid);
    }
  }

  configureService = (serviceUuid, config) => {
    const service = this.getServiceById(serviceUuid);
    if (service) {
      service.configure(config);
    } else {
      console.error('Configuring service failed', serviceUuid);
    }
  }

  // TODO: this should not happen here. Is a command to the backend not the UI component
  // Probably the boardContext should be the receiver
  destroyService = service => {
    return this.impl && this.impl.destroyService && this.impl.destroyService(service);
  } 

  // TODO: this should not happen here. Is a command to the backend not the UI component
  // only makes sense for the BrowserRuntime as this hosts the real service not only the UI
  destroyRuntime = () => {
    return this.impl && this.impl.destroyRuntime && this.impl.destroyRuntime();
  }

  renderServiceMenu(runtimeId, runtimeName, registry, appViewMode) {
    const wide = appViewMode === 'wide';
    const options = registry.map(s => ({
      key: `${runtimeId}${s.serviceId}`, 
      value: s.serviceId, 
      text: s.serviceName,
    }));
    return (
      <div
        id="service-dropdown"
        style={{
          fontSize: 12,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginRight: 10
        }}
      >
        <Dropdown
          ref={dropdown => this.dropdown = dropdown }
          deburr
          options={options}
          placeholder={wide ? 'Add Service' : 'Service'}
          search
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => {
            if (value) {
              const service = registry.find(s => s.serviceId === value);
              if (service) {
                this.onAddService(service);
                this.dropdown.clearValue();
              }
            }
          }}
          compact={!wide}
        />
      </div>
    );
  }

  renderExpandableHeadline(id, name, registry, isOwner, appViewMode) {
    const { 
      expanded, 
      showSettings,
    } = this.state;

    return (
      <div 
        style={{ 
          width: '100%',
          marginTop: 5,
          marginLeft: 5,
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        <Icon 
          name="bars"
          style={{
            margin: '10px 18px', 
            cursor: 'pointer',
            color: '#ddd' 
          }}
          onClick={() => this.setState({ 
            showSettings: expanded && !showSettings,
            expanded: !expanded ? !showSettings : expanded
          })}
        />
        <div 
          style={{
            ...t.unselectable, 
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 10,
          }}
          onDoubleClick={() => this.setState({
              expanded: !expanded
            })
          }
        > 
          {name}
        </div>
        <div 
          style={{ 
            marginRight: 10, 
            marginTop: 5, 
            marginBottom: 10,
            marginLeft: 'auto',
            textAlign: 'right'
          }} 
        >
          {
            registry && 
            isOwner && 
            this.renderServiceMenu(id, name, registry, appViewMode) 
          }
        </div>
      </div>
    );
  }

  renderSettings = (runtime, onToggleOwnership, isOwner) => {
    const { 
      expanded, 
      showSettings, 
      wrapServices,
    } = this.state;
    const { boardContext } = this.props;
    const { services: allServices = [] } = boardContext;
    const services = allServices[runtime.id];
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
          onClick={() => 
            (services.length === 0) ? 
              boardContext.removeRuntime(runtime) :
              boardContext.removeAllServices(runtime)
          }
        >
          <Icon name={(!services || services.length === 0) ? 'trash alternate outline' : 'remove'} />
        </Menu.Item>
        <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => this.setState({
            expanded: !expanded,
            showSettings: showSettings && !expanded
          })}
        >
          <Icon name='compress' />
        </Menu.Item>
        <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => this.setState({ wrapServices: !wrapServices })}
        >
          <Icon 
            name={ wrapServices ? 'exchange' : 'sort amount down' }
          />
        </Menu.Item>
        <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => {}}
        >
          <Icon name='keyboard' />
        </Menu.Item>
        {
          runtime && runtime.type === 'browser' && (
            <Menu.Item
              as='a'
              style={itemStyle}
              onClick={() => onToggleOwnership && onToggleOwnership() }
            >
              <Icon name={isOwner ? 'unlink' : 'linkify'} />
            </Menu.Item>
          )
        }
      </Menu>
    );
  }
  
  render() {
    const { 
      style,
      runtime=null,
      boardContext=null,
      frameless=false,
      onResult=undefined,
    } = this.props;

    const runtimeId = runtime && runtime.id;
    const runtimeName = runtime ? runtime.name : 'Blank';
    const services = boardContext && boardContext.services[runtime && runtime.id];
    const userId = boardContext && boardContext.user && boardContext.user.userId;
    const boardName = boardContext && boardContext.boardName;
    const registry = boardContext && boardContext.registry[runtime && runtime.id];
    const appViewMode = boardContext && boardContext.appViewMode;
    const wide = boardContext ? appViewMode === 'wide' : true;
    const isOwner = boardContext && boardContext.isRuntimeInScope(runtime);
    
    const {
      wrapServices=!wide,
      showSettings,
      expanded,
    } = this.state;

    const readonly = !registry;
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

    const onArrangeService = (serviceUuid, position) => boardContext.arrangeService(
      runtime, serviceUuid, position
    );

    const onToggleOwnership = () => 
      boardContext.isRuntimeInScope(runtime) ? 
        boardContext.releaseRuntimeScope(boardContext.boardName, runtime) :
        boardContext.acquireRuntimeScope(boardContext.boardName, runtime);

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
          !frameless && this.renderExpandableHeadline(runtimeId, runtimeName, registry, isOwner, appViewMode)
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
            visible={showSettings}
            style={{ 
              overflowX: 'hidden',
              boxShadow: '0 0 2px rgba(34,36,38,.15)',
            }}
          >
            { this.renderSettings(runtime, onToggleOwnership, isOwner) }
          </Sidebar>
          <div
            style={{
              display: 'flex',
              flexFlow: wrapServices  ? 'row wrap' : 'row nowrap',
              overflow: 'auto',
              ...readonlyStyle
            }}
            onClickCapture={e => readonly && e.stopPropagation()}
          >
          {
            expanded && runtime && runtime.type === 'node' && (
              <RemoteRuntime
                ref={rt => this.impl = rt}
                userId={userId}
                boardName={boardName}
                runtime={runtime}
                services={services}
                readonly={readonly}
                registry={registry}
                onArrangeService={onArrangeService}
                onServiceAction={this.onServiceAction}
              />
            )
          }
          {
            expanded && runtime && runtime.type === 'browser' && (
              <BrowserRuntime
                ref={rt => this.impl = rt}
                userId={userId}
                boardName={boardName}
                runtime={runtime}
                services={services}
                readonly={readonly}
                registry={registry}
                onArrangeService={onArrangeService}
                onServiceAction={this.onServiceAction}
                onResult={onResult}
              />
            )
          }
          { 
            ((services && services.length === 0) || !isOwner) && (
              <div style={{ height: showSettings ? 180 : 10 }} />  // just a placeholder for visual consistence
            )
          }
          </div>
        </Sidebar.Pushable>
      </div>
    );
  }
}
