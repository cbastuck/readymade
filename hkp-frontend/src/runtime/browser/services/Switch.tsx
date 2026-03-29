// import ServiceUI from './ServiceUI';

const serviceId = "hookup.to/service/switch";
const serviceName = "Switch";

function SwitchUI(): JSX.Element {
  return <div />;
}

class Switch {
  uuid: string;
  board: any;
  app: any;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(_config: any): void {}

  process(params: any): any {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Switch(app, board, _descriptor, id),
  createUI: SwitchUI,
};

export default descriptor;
