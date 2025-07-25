import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import GithubSourceUI from "./GithubSourceUI";

const serviceId = "hookup.to/service/github-source";
const serviceName = "Github Source";

class GithubSource {
  uuid: string;
  board: string;
  app: AppInstance;

  token: string;
  owner: string;
  repo: string;
  branch: string;
  file: any;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = ""; //this.app.restoreServiceData(this.uuid, loginStateId);
    this.owner = "";
    this.repo = "";
    this.branch = "";
    this.file = null;
  }

  async configure(config: any) {
    const { token, owner, repo, branch, file } = config;
    if (token !== undefined) {
      this.token = token;
      this.app.notify(this, { token });
    }

    if (owner !== undefined) {
      this.owner = owner;
      this.app.notify(this, { owner });
    }

    if (repo !== undefined) {
      this.repo = repo;
      this.app.notify(this, { repo });
    }

    if (branch !== undefined) {
      this.branch = branch;
      this.app.notify(this, { branch });
    }

    if (file !== undefined) {
      this.file = file;
      this.app.notify(this, { file });
    }
  }

  destroy() {}

  inject(params: any) {
    return this.app.next(this, params);
  }

  process(params: any) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new GithubSource(app, board, descriptor, id),
  createUI: GithubSourceUI,
};

export default descriptor;
