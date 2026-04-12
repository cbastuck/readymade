const serviceId = "hookup.to/service/stopper";
const serviceName = "Stopper";

class Stopper {
  uuid: string;
  board: any;
  app: any;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(_config: any): void {}

  process(_params: any): null {
    return null;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, descriptor: any, id: string) =>
    new Stopper(app, board, descriptor, id),
};

export default descriptor;
