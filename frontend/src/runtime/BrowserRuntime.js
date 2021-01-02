import React, { Component } from 'react';
import EventSource from 'eventsource';
import { decode } from 'base64-arraybuffer';

import { request } from '../core/actions';
import { parseResponse } from './MultiformParser';
import { restoreToken } from '../core/Auth';
import { serializeWebsocketBuffer } from '../core/format';
import ServiceContainer from './ServiceContainer';

//TODO: remove
import defaultRegistry from './registry/Default';

function logInfo(msg) {
  // console.log(msg);
}

function serviceDataKey(uuid, key) {
  return `service-data-${uuid}-${key}`;
}

export default class BrowserRuntime extends Component {
  static async createInstance(runtime, { user, bundles, ...params } = {}) {
    const registry = await BrowserRuntime.registry(user, bundles);
    return new BrowserRuntime(runtime, { ...params, user, registry });
  }

  static findServiceUi(serviceId) {
    const a = BrowserRuntime.__createdRegistry || defaultRegistry;
    return a.find(s => serviceId === s.serviceId && s.createUI);
  }

  componentDidMount() {
    const that = this;
    this.app = {
      next: that.next,
      getServiceById: id => this.services.find(s => s.uuid === id),
      sendAction: action => {
        // the sandbox for example registers a listener 
        // for these kind of actions
        const target = window.frameElement;
        if (target && target.onAction) {
          target.onAction(action);
        }
      },
      storeServiceData: (serviceUuid, key, value) => {
        localStorage.setItem(serviceDataKey(serviceUuid, key), value);
      },
      restoreServiceData: (serviceUuid, key) => {
        return localStorage.getItem(serviceDataKey(serviceUuid, key)) || undefined;
      },
      removeServiceData: (serviceUuid, key) => {
        localStorage.removeItem(serviceDataKey(serviceUuid, key));
      },
      notify: (service, notification) => {
        if (service.__notificationTarget) {
          return service.__notificationTarget(service, notification);
        }
      }
    }
  }

  next = async (service, params, requestId=null, advanceBeforeProcess=true) => {
    const { runtime } = this.pops;
    
    const position = this.services.findIndex(s => s === service);
    if (position === -1) {
      return console.error('Called next() in browser but could not find current service', service);
    }

    let svc = this.services[position];
    let result = params;
    for (let i = advanceBeforeProcess ? position+1 : position; !!this.services[i]; ++i) {
      svc = this.services[i];
      result = await svc.process(params);
      params = result;
    }
    const resultReceiver = runtime.sendResult || this.sendResult;
    await resultReceiver(svc.uuid, result, requestId);
    return result;
  }

  connect(id) {
    const { board, user, runtimeName } = this.props;
    const backendPath = `/api/${user.userId}/${board}/${id}`;
    logInfo(`Connecting ${runtimeName} to ${backendPath}`);
    
    const useWebSockets = true;
    if (useWebSockets) {
      // TODO: assume coordinator is on the same host as frontend
      const { host: backendHost, protocol } = window.location;
      const secureConnection = protocol.indexOf('https') === 0;
      this.connectRuntimeViaWebSocket(backendHost, backendPath, secureConnection);
    } else {
      this.connectRuntimeViaEventSource(backendPath);
    }
  }

  connectRuntimeViaWebSocket(backendHost, backendPath, secureConnection) {
    const { runtimeId, runtimeName } = this.props;
    function rebuild(json, message) {
      return Object.keys(json).reduce(
        (acc, key) => {
          const value = json[key];
          if (typeof value === 'object') {
            return { ...acc, [key]: rebuild(value, message) };
          }
          if (value.startsWith && value.startsWith('+binary-data-@')) {
            const blob = new Blob(
              [message[value].payload],
              { type : message[value].headers['content-type'] },
            );
            return { ...acc, [key]: blob };
          } else {
            return { ...acc, [key]: value };
          }
        },
        {}
      );
    }

    const protocol = secureConnection ? 'wss' : 'ws';
    this.websocket = new WebSocket(`${protocol}://${backendHost}${backendPath}`, restoreToken());
    this.websocket.binaryType = 'arraybuffer';
    this.websocket.onmessage = event => {
      const message = parseResponse(event.data);
      const action = message.json ? rebuild(message.json.payload, message) : JSON.parse(message);
      logInfo(`BrowserRuntime ${runtimeId} (${runtimeName}) received: ${JSON.stringify(action)}`);
      this.onMessage(action);
    };
    this.websocket.onclose = event => {
      logInfo(`Closed WebSocket with ${runtimeId}`);
    };
    this.websocket.onerror = function(error) {
      console.error(`WebSocket ${runtimeId} Error: `, error);
    };
    this.websocket.onopen = event => {
      logInfo(`WebSocket to ${runtimeId} is open`);
    }
  }

  connectRuntimeViaEventSource(backendPath) {
    const { runtimeId } = this.props;
    this.eventSource = new EventSource(backendPath);
    
    const onMessage = e => this.onMessage(e.data ? JSON.parse(e.data) : e);
    const onError = error => {
      if (error.status === 504) { // HTTP Gateway Timeout 
        this.eventSource.removeEventListener('data', onMessage);
        this.eventSource.removeEventListener('error', onError);
        this.eventSource = undefined;
        logInfo(`Reconnecting browser runtime ${error} - ${error.status}`);
        setTimeout(() => this.connect(runtimeId), 1000);
        return;
      } else {
        console.error('Unknown error in BrowserRuntime', error);
      }
    }
    this.eventSource.addEventListener(
      'data',
      onMessage
    );
    this.eventSource.addEventListener(
      'error',
      onError
    );
  }

  onMessage(command) {
    switch (command.action) {
      case 'create':
        return this.createService(command.descriptor, command.uuid, command.initialConfig);
      case 'config':
        return this.configureService(command.uuid, command.config);
      case 'process':
        return this.processService(command.uuid, command.params, command.requestId);
      case 'destroy':
        return this.destroyService(command.uuid);
      case 'ping':
        return;
      default:
        console.error('Unknown action in browser runtime: ', command);
    }
  }

  async sendResult(serviceUuid, data, requestId) {
    const { user, runtimeId } = this.props;
    if (!runtimeId) {
      return console.error('Could not send result data, no backend is connected');
    }

    if (this.websocket) { // send the result via websocket
      const buffer = await serializeWebsocketBuffer(
        data, 
        {
          board: this.board,
          userId: user.userId,
          serviceUuid,
          requestId,
        }
      );
      this.websocket.send(buffer);
      return null;
    } else { // ... or as post
      return request(`${user.userId}/${this.board}/${runtimeId}/${requestId}`, 'POST', false, data);
    }
  }

  createService({ serviceId, serviceName, board }, id, initialConfig) {
    const { registry } = this.props;
    const descriptor = registry.find(elem => elem.serviceId === serviceId);
    if (descriptor) {
      const service = descriptor.create(this.app, board, descriptor, id);
      service.__descriptor = { ...descriptor, serviceName: serviceName || descriptor.serviceName };
      if (initialConfig) {
        service.configure(initialConfig);
      }
      this.services.push(service);
      return service;
    } else {
      console.error('No browser service descriptor found for ', serviceId, registry)
    }
  }

  configureService(uuid, config) {
    const service = this.services.find(s => s.uuid = uuid);
    if (!service) {
      return console.error(`Could not find browser service to configure: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.configure(config);
  }

  async processService(uuid, params, requestId) {
    const position = (uuid === null) ? 0 : this.services.findIndex(s => s.uuid = uuid);
    if (position === -1) {
      return console.error(`Could not find browser service to process: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    
    // if it's not an object it's a binary buffer base64 encoded
    const data = typeof params === 'string' ?
      new Blob(
        [decode(params)], 
        { type: 'application/octet-binary' }
      ) :
      params;

    const service = this.services[position];
    if (service) {
      return this.next(service, data, requestId, false);
    }
  }

  destroyService(uuid) {
    const service = this.services.find(s => s.uuid = uuid);
    if (!service) {
      return console.error(`Could not find browser service to process: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.destroy && service.destroy();
  }

  getServiceById(uuid) {
    return this.services.find(s => s.uuid === uuid);
  }

  destroyRuntime() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    } 
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }
  }

  render() {
    const { services, ...props } = this.props;
    return (
      <ServiceContainer
        {...props} 
        services={services} 
      />
    );
  }
};