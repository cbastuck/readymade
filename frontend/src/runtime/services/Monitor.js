const serviceId = 'hookup.to/service/monitor';
const serviceName = 'Monitor';

class Monitor {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure() {
    console.log('Configuring Monitor')
  }

  process(params) {
    console.log('Browser monitors incoming ', params);
    return params;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Monitor(app, board, descriptor, id)
};

export default descriptor;
