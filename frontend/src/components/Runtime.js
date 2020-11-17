import React, { Component } from 'react';
import { 
  Icon,
  Sidebar,
  Segment,
  Menu,
  Dropdown,
} from 'semantic-ui-react';

import ServiceFrame from './ServiceFrame';
import { openTab } from '../core/actions';
import { createServiceUI, createPlaceholderUI } from '../UIFactory';

import './Runtime.css';

export default class Runtime extends Component {
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
    const { boardContext } = this.props;
    if (boardContext) {
      boardContext.addService(service);
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
      default: 
        console.log('Scene processing unknown service action', action);
    }
  }

  renderServiceMenu(runtimeName, runtime) {
    const serviceNameStyle = {
      fontSize: 12,
      letterSpacing: 1,
      textTransform: 'uppercase',
    };
    const registry = runtime ? runtime.registry : [];
    const options = registry.map(s => ({
      key: `${runtime.id}${s.serviceId}`, value: s.serviceId, text: s.serviceName
    }));
    return (
      <div
        id="service-dropdown"
        style={{
          ...serviceNameStyle,
          width: 180
        }}
      >
        <Dropdown
          ref={dropdown => this.dropdown = dropdown }
          deburr
          fluid
          options={options}
          placeholder="Add Service"
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
        />
      </div>
    );
  }

  renderExpandableHeadline(name, runtime) {
    const sceneNameStyle = {
      fontSize: 12,
      letterSpacing: 1,
      textTransform: 'uppercase',
    }; 
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
              showSettings: this.state.expanded && !this.state.showSettings,
              expanded: !this.state.expanded ? !this.state.showSettings : this.state.expanded
            })}
          />
          <span style={sceneNameStyle}> 
            {name} 
          </span>
          <span style={{ marginRight: 10, marginTop: 5, float: 'right' }} >
            {
             runtime && runtime.registry && this.renderServiceMenu(name, runtime)
            }
          </span>
        </div>
      </h4>
    );
  }

  renderSettings = (runtime, onToggleOwnership, isOwner) => {
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
      runtimeName=runtime ? runtime.name : 'Blank',
      frameless=false,
      boardContext=null,
      services=[],
      runtimeId=runtime && runtime.id,
      userId=boardContext && boardContext.userId,
      boardName=boardContext && boardContext.boardName,
    } = this.props;

    const isOwner = boardContext && boardContext.isRuntimeInScope(runtime);
    const readonly = !isOwner && !!runtime;
    const onToggleOwnership = () => 
      boardContext.isRuntimeInScope(runtime) ? 
        boardContext.releaseRuntimeScope(boardContext.boardName, runtime) :
        boardContext.acquireRuntimeScope(boardContext.boardName, runtime);

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
          !frameless && this.renderExpandableHeadline(runtimeName, runtime)
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
            { this.renderSettings(runtime, onToggleOwnership, isOwner) }
          </Sidebar>
          <div
            style={{
              display: 'flex',
              flexFlow: wrapServices ? 'row wrap' : 'row nowrap',
              overflow: 'auto',
              padding: !frameless && '0px 10px',
              ...readonlyStyle
            }}
            onClickCapture={e => readonly && e.stopPropagation()}
          >
          {
            this.state.expanded && services && services.map(service => {
              const serviceUi = readonly ? 
                createPlaceholderUI(service) :
                createServiceUI(boardName, service, runtimeId, userId)
              return (
                <ServiceFrame
                  key={`scene-frame-${service.uuid}`}
                  service={service}
                  serviceUi={serviceUi}
                  onAction={this.onServiceAction}
                />
              );
            })
          }
          </div>
        </Sidebar.Pushable>
      </div>
    );
  }
}
