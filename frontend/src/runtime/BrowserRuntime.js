import timerDescriptor from './services/Timer';
import monitorDescriptor from './services/Monitor';
import microphoneDescriptor from './services/Microphone';

export default class BrowserRuntime {
  static registry() {
    return [
      timerDescriptor,
      monitorDescriptor,
      microphoneDescriptor
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
    this.backendUrl = `/api/${id}`;
    this.eventSource = new EventSource(this.backendUrl);
    this.eventSource.addEventListener(
      'data',
      this.onMessage.bind(this)
    );
  }

  onMessage(e) {
    const command = JSON.parse(e.data);
    switch (command.action) {
      case 'create':
        return this.createService(command.descriptor, command.uuid);
      case 'config':
        return this.configureService(command.uuid, command.config);
      default:
        console.error('Unknown action in browser runtime: ', command);
    }
  }

  async sendResult(data) {
    if (!this.backendUrl) {
      return console.error('Could not send result data, no backend is connected');
    }
    const isBinary = data instanceof Blob;
    await fetch(
      this.backendUrl, 
      { 
        method: 'POST', 
        body: isBinary ? await new Response(data).arrayBuffer() : JSON.stringify(data),
        headers: {
          'Content-Type': isBinary ? data.type : 'application/json',
        }
      }
    );
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
      return console.error(`Could not find service to configure: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.configure(config);
  }

  getServiceById(uuid) {
    return this.services.find(s => s.uuid = uuid);
  }
};