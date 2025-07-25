import moment from "moment";

import { commit } from "./GithubAPI";
import GithubSinkUI from "./GithubSinkUI";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/github-sink";
const serviceName = "Github Sink";

type State = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  file: any;
};
class GithubSink extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      token: "", //this.app.restoreServiceData(this.uuid, loginStateId);
      owner: "",
      repo: "",
      branch: "",
      file: "",
    });

    this.bypass = true;
  }

  async configure(config: any) {
    const { token, owner, repo, branch, file } = config;
    if (token !== undefined) {
      this.state.token = token;
      // this.app.storeServiceData(this.uuid, loginStateId, token);
      this.app.notify(this, { token });
    }

    if (owner !== undefined) {
      this.state.owner = owner;
      this.app.notify(this, { owner });
    }

    if (repo !== undefined) {
      this.state.repo = repo;
      this.app.notify(this, { repo });
    }

    if (branch !== undefined) {
      this.state.branch = branch;
      this.app.notify(this, { branch });
    }

    if (file !== undefined) {
      this.state.file = typeof file === "string" ? { name: file } : file;
      this.app.notify(this, { file: this.state.file });
    }
  }

  async destroy() {}

  async process(params: any) {
    if (this.state.token) {
      const isBlob = params instanceof Blob;
      const data = isBlob ? params : JSON.stringify(params, null, 2);
      return await commit(
        this.state.token,
        this.state.owner,
        this.state.repo,
        this.state.branch,
        this.state.file.name,
        data,
        `${this.board} - ${moment().toISOString()}`
      );
    }
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
  ) => new GithubSink(app, board, descriptor, id),
  createUI: GithubSinkUI,
};

export default descriptor;
