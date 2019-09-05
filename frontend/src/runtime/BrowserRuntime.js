import timerDescriptor from './services/Timer';

export default class BrowserRuntime {
  static registry() {
    return [
      timerDescriptor
    ];
  }

  constructor(name) {
    this.name = name;
    this.registry = BrowserRuntime.registry();
    this.services = [];
  }

  connect(id) {
    this.eventSource = new EventSource(`/api/${id}`);
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

  createService({ serviceId, board }, id) {
    const descriptor = this.registry.find(elem => elem.serviceId === serviceId);
    if (descriptor) {
      const service = descriptor.create(board, descriptor, id);
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
};