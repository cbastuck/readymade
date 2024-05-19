import moment from "moment";

import { AppImpl, ServiceClass, User } from "../../../types";
import CloudSinkUI from "./CloudSinkUI";

const serviceId = "hookup.to/service/cloud-sink";
const serviceName = "Cloud-Sink";

const documentStoreUrl = "https://cloud.hookup.to/store/document";

type Config = {
  resourceType: string;
  resourceId: string;
  conflictStrategy: string;
};

class CloudSink {
  app: AppImpl;
  board: string;
  uuid: string;

  resourceId: string = `cloud-sink-${moment().format("YYYMMDD")}`;
  resourceType: string = "document";
  conflictStrategy = "overwrite";

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
    const { resourceId, conflictStrategy } = config;
    if (resourceId !== undefined) {
      this.resourceId = resourceId;
      this.app.notify(this, { resourceId });
    }
    if (conflictStrategy !== undefined) {
      this.conflictStrategy = conflictStrategy;
      this.app.notify(this, { conflictStrategy });
    }
  }

  async destroy() {}

  async process(params: any) {
    const user = this.app.getAuthenticatedUser();
    if (user) {
      const payload = { message: JSON.stringify(params) };
      makeRequest(this.resourceId, payload, user, this.conflictStrategy);
    }

    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new CloudSink(app, board, descriptor, id),
  createUI: CloudSinkUI,
};

export default descriptor;

export async function makeRequest(
  resourceId: string,
  payload: { message: any },
  user: User,
  conflictStrategy: string
) {
  const resp = await fetch(
    `${documentStoreUrl}/${resourceId}?conflictStrategy=${conflictStrategy}`,
    {
      method: "put",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${user.idToken}`,
      },
      body: JSON.stringify(payload),
    }
  );
  return await resp.text();
}
