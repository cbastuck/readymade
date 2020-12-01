import EventSource from 'eventsource';
import { decode } from 'base64-arraybuffer';

import { request } from '../core/actions';
import { parseResponse } from './MultiformParser';
import { restoreToken } from '../core/Auth';
import { serializeWebsocketBuffer } from '../core/format';
import defaultRegistry from './registry/Default';
import { loadBundle } from './Bundles';

function logInfo(msg) {
  // console.log(msg);
}

function serviceDataKey(uuid, key) {
  return `service-data-${uuid}-${key}`;
}

export default class BrowserRuntime {
  static async createInstance(runtime, { user, bundles, ...params } = {}) {
    const registry = await BrowserRuntime.registry(user, bundles);
    return new BrowserRuntime(runtime, { ...params, user, registry });
  }

  static findServiceUi(serviceId) {
    const a = BrowserRuntime.__createdRegistry || defaultRegistry;
    return a.find(s => serviceId === s.serviceId && s.createUI);
  }

  static async loadBundles(bundles) {
    if (bundles) {
      const appendBundleServices = arr => arr.forEach(x => {
        const exists = BrowserRuntime.__createdRegistry && 
                      BrowserRuntime.__createdRegistry.find(
                        s => x.serviceId === s.serviceId);
        if (!exists) {
          if (BrowserRuntime.__createdRegistry) {
            BrowserRuntime.__createdRegistry.push(x);
          } else {
            BrowserRuntime.__createdRegistry = [x];
          }
        }
      });
      for (const bundleId of bundles) {
        const bdl = await loadBundle(bundleId);
        appendBundleServices(bdl);
      }
    }
    return BrowserRuntime.__createdRegistry;
  }

  static async registry(user, bundles) {
    if (!BrowserRuntime.__createdRegistry) {
      BrowserRuntime.__createdRegistry = defaultRegistry;

      // TODO: rename to user registry to user bundles
      if (user && user.features && user.features.registry) {
        const userBundles = JSON.parse(user.features.registry);
        await BrowserRuntime.loadBundles(userBundles); 
      }
    }

    if (bundles) {
      await BrowserRuntime.loadBundles(bundles);
    }

    return BrowserRuntime.__createdRegistry;
  }

  constructor(runtime, { board, user, registry } = {}) {
    this.registry = registry;
    this.id = runtime.id;
    this.name = runtime.name;
    this.services = runtime.services || [];
    this.app = {
      next: this.next,
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

    if (board) {
      this.board = board;
    }

    if (user) {
      this.user = user;
    }
    
    if (runtime.sendResult) {
      this.sendResult = runtime.sendResult;
    }
  }

  next = async (service, params, requestId=null, advanceBeforeProcess=true) => {
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
    await this.sendResult(svc.uuid, result, requestId);
    return result;
  }

  connect(id) {
    this.id = id; // TODO: do we need this? Already done in c'tor
    const backendPath = `/api/${this.user.userId}/${this.board}/${id}`;
    logInfo(`Connecting ${this.name} to ${backendPath}`);
    
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
      logInfo(`BrowserRuntime ${this.id} (${this.name}) received: ${JSON.stringify(action)}`);
      this.onMessage(action);
    };
    this.websocket.onclose = event => {
      logInfo(`Closed WebSocket with ${this.id}`);
    };
    this.websocket.onerror = function(error) {
      console.error(`WebSocket ${this.id} Error: `, error);
    };

    this.websocket.onopen = event => {
      logInfo(`WebSocket to ${this.id} is open`);
    }
  }

  connectRuntimeViaEventSource(backendPath) {
    this.eventSource = new EventSource(backendPath);
    
    const onMessage = e => this.onMessage(e.data ? JSON.parse(e.data) : e);
    const onError = error => {
      if (error.status === 504) { // HTTP Gateway Timeout 
        this.eventSource.removeEventListener('data', onMessage);
        this.eventSource.removeEventListener('error', onError);
        this.eventSource = undefined;
        logInfo(`Reconnecting browser runtime ${error} - ${error.status}`);
        setTimeout(() => this.connect(this.id), 1000);
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
    if (!this.id) {
      return console.error('Could not send result data, no backend is connected');
    }

    if (this.websocket) { // send the result via websocket
      const buffer = await serializeWebsocketBuffer(
        data, 
        {
          board: this.board,
          userId: this.user.userId,
          serviceUuid,
          requestId,
        }
      );
      this.websocket.send(buffer);
      return null;
    } else { // ... or as post
      return request(`${this.user.userId}/${this.board}/${this.id}/${requestId}`, 'POST', false, data);
    }
  }

  createService({ serviceId, serviceName, board }, id, initialConfig) {
    const descriptor = this.registry.find(elem => elem.serviceId === serviceId);
    if (descriptor) {
      const service = descriptor.create(this.app, board, descriptor, id);
      service.__descriptor = { ...descriptor, serviceName: serviceName || descriptor.serviceName };
      if (initialConfig) {
        service.configure(initialConfig);
      }
      this.services.push(service);
      return service;
    } else {
      console.error('No browser service descriptor found for ', serviceId, this.registry)
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
    const position = this.services.findIndex(s => s.uuid = uuid);
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
    return this.next(service, data, requestId, false);
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

};