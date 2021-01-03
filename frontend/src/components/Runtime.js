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
              this.onAddService(service);
              this.dropdown.clearValue();
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
    const itemStyle = { 
      height: 40,
      margin: 0,
    };
    const { 
      expanded, 
      showSettings, 
      wrapServices,
    } = this.state;
    return (
      <Menu
        vertical
        compact
        style={{ height: '100%' }}
      >
       <Menu.Item
          as='a'
          style={itemStyle}
          onClick={() => {
            const { boardContext, runtime } = this.props;
            return boardContext.removeAllServices(runtime)
          }}
        >
          <Icon name='remove' />
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
      runtimeId=runtime && runtime.id,
      runtimeName=runtime ? runtime.name : 'Blank',
      boardContext=null,
      services=boardContext && boardContext.services[runtime && runtime.id],
      userId=boardContext && boardContext.user && boardContext.user.userId,
      boardName=boardContext && boardContext.boardName,
      registry=boardContext && boardContext.registry[runtime && runtime.id],
      frameless=false,
      onResult=undefined,
    } = this.props;

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
                userId={userId}
                boardName={boardName}
                runtime={runtime}
                services={services}
                readonly={readonly}
                registry={registry}
                onArrangeService={onArrangeService}
              />
            )
          }
          {
            expanded && runtime && runtime.type === 'browser' && (
              <BrowserRuntime
                userId={userId}
                boardName={boardName}
                runtime={runtime}
                services={services}
                readonly={readonly}
                registry={registry}
                onArrangeService={onArrangeService}
                onResult={onResult}
              />
            )
          }
          { 
            services && services.length === 0 && (
              <div style={{ height: 9 }} />  // just a placeholder for visual consistence
            )
          }
          {
            showSettings && (!isOwner || (services && services.length === 0)) && (
              <div style={{ height: 180 }} />
            )
          }
          </div>
        </Sidebar.Pushable>
      </div>
    );
  }
}
