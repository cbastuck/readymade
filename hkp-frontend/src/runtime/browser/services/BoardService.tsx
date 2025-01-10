import { AppImpl, ServiceClass } from "../../../types";
import BoardServiceUI from "./BoardServiceUI";

const serviceId = "hookup.to/service/board-service";
const serviceName = "Board-Service";

type Config = {
  result: any;
  selectedBoard: string;
  command?: {
    action: string;
    params: any;
    promise?: { resolve: (result: any) => void; reject: (err: Error) => void };
  };
};

class BoardService {
  app: AppImpl;
  board: string;
  uuid: string;
  selectedBoard: string | null = null;

  constructor(
    app: AppImpl,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async configure(config: Partial<Config>) {
    if (Object.prototype.hasOwnProperty.call(config, "result")) {
      this.app.next(this, config.result);
    }

    if (config.selectedBoard !== undefined) {
      this.selectedBoard = config.selectedBoard;
    }
  }

  async destroy() {}

  process(params: any) {
    return new Promise((resolve, reject) => {
      this.app.notify(this, {
        command: {
          action: "process",
          params,
          promise: { resolve, reject },
        },
      });
    });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new BoardService(app, board, descriptor, id),
  createUI: BoardServiceUI,
};

export default descriptor;
