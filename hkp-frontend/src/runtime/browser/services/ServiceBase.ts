import { AppInstance, ServiceClass } from "@/types";

export default class ServiceBase<T> {
  uuid: string;
  board: string;
  app: AppInstance;
  state: T;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    uuid: string,
    s: T
  ) {
    this.uuid = uuid;
    this.board = board;
    this.app = app;
    this.state = s;
  }
}
