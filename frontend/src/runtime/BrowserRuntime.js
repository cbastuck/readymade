import timerDescriptor from './services/Timer';
import monitorDescriptor from './services/Monitor';
import microphoneDescriptor from './services/Microphone';
import playbackDescriptor from './services/Playback';
import { request } from '../core/actions';

export default class BrowserRuntime {
  static registry() {
    return [
      timerDescriptor,
      monitorDescriptor,
      microphoneDescriptor,
      playbackDescriptor
    ];
  }

  constructor(name) {
    this.name = name;
    this.registry = BrowserRuntime.registry();
    this.services = [];

    this.app = {
      next: async (service, params) => {
        const position = this.services.findIndex(s => s === service);
        if (position === -1) {
          return console.log('Called next() runtime, but could not find current', service);
        }

        let result = params;
        for (let i = position+1; !!this.services[i]; ++i) {
          const s = this.services[i];
          result = await s.process(params);
          params = result;
        }

        await this.sendResult(result);
        return result;
      }
    }
  }

  connect(id) {
    this.id = id;
    const backendUrl = `/api/${id}`;
    this.eventSource = new EventSource(backendUrl);
    const onMessage = event => this.onMessage(event);
    const onError = error => {
      if (error.target.readyState === EventSource.CLOSED) {
        this.eventSource.removeEventListener('data', onMessage);
        this.eventSource.removeEventListener('error', onError);
        this.eventSource = undefined;
        return this.connect(id);
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

  onMessage(e) {
    const command = JSON.parse(e.data);
    switch (command.action) {
      case 'create':
        return this.createService(command.descriptor, command.uuid);
      case 'config':
        return this.configureService(command.uuid, command.config);
      case 'process':
        return this.processService(command.uuid, command.params);
      default:
        console.error('Unknown action in browser runtime: ', command);
    }
  }

  sendResult(data) {
    if (!this.id) {
      return console.error('Could not send result data, no backend is connected');
    }
   return request(this.id, 'POST', false, data);
  }

  createService({ serviceId, board }, id) {
    const descriptor = this.registry.find(elem => elem.serviceId === serviceId);
    if (descriptor) {
      const service = descriptor.create(this.app, board, descriptor, id);
      this.services.push(service);
    }
  }

  configureService(uuid, config) {
    const service = this.services.find(s => s.uuid = uuid);
    if (!service) {
      return console.error(`Could not find browser service to configure: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.configure(config);
  }

  processService(uuid, params) {
    const service = this.services.find(s => s.uuid = uuid);
    if (!service) {
      return console.error(`Could not find browser service to process: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.process(params);
  }

  getServiceById(uuid) {
    return this.services.find(s => s.id === uuid);
  }
};