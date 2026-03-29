import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/dispatcher";
const serviceName = "Dispatcher";

function DispatcherUI(props: any): JSX.Element {
  return (
    <ServiceUI {...props}>
      {({ service }: { service: any }) => service && <div />}
    </ServiceUI>
  );
}

type DispatchDestination = {
  config?: any;
  process?: any;
  serviceUuid: string;
};

type DispatchItem = {
  type: string;
  destinations: DispatchDestination[];
};

class Dispatcher {
  uuid: string;
  board: any;
  app: any;

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(_config: any): void {}

  async dispatch(item: DispatchItem | null | undefined): Promise<any> {
    const { type, destinations } = item || {};
    if (!item || type !== "dispatch" || !destinations) {
      return;
    }

    for (const dest of destinations) {
      const { config, process, serviceUuid } = dest;
      const service = this.app.getServiceById(serviceUuid);
      if (service) {
        if (config) {
          await service.configure(config);
        }
        if (process) {
          return await service.process(process);
        }
      }
    }
  }

  async process(params: DispatchItem | DispatchItem[]): Promise<DispatchItem | DispatchItem[]> {
    if (Array.isArray(params)) {
      await Promise.all(params.map((x) => this.dispatch(x)));
    } else {
      await this.dispatch(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Dispatcher(app, board, _descriptor, id),
  createUI: DispatcherUI as any,
};

export default descriptor;
