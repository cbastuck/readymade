import { AppImpl, ServiceClass } from "../../../types";

import { User } from "@auth0/auth0-react";
import CloudSourceUI from "./CloudSourceUI";

const serviceId = "hookup.to/service/cloud-source";
const serviceName = "Cloud-Source";

type Config = {
  resourceType: string;
  resourceId: string;
  matchResourceIdExact: boolean;
  command: { action: string };
};

const documentStoreUrl = "https://cloud.hookup.to/store/document";

class CloudSource {
  app: AppImpl;
  board: string;
  uuid: string;

  resourceId: string = "";
  resourceType: string = "document";
  matchResourceIdExact: boolean = true;

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
    const { resourceId, command, matchResourceIdExact } = config;
    if (resourceId !== undefined) {
      this.resourceId = resourceId;
      this.app.notify(this, { resourceId });
    }
    if (command !== undefined) {
      if (command.action === "retrieve") {
        this.app.next(this, await this.doProcess({}));
      }
    }
    if (matchResourceIdExact !== undefined) {
      this.matchResourceIdExact = matchResourceIdExact;
      this.app.notify(this, { matchResourceIdExact });
    }
  }

  async destroy() {}

  async process(params: any) {
    return this.doProcess(params);
  }

  doProcess = async (_params: any) => {
    const user = this.app.getAuthenticatedUser();
    if (!this.resourceId || !user) {
      return null;
    }
    return makeRequest(this.resourceId, user, this.matchResourceIdExact);
  };
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new CloudSource(app, board, descriptor, id) as any,
  createUI: CloudSourceUI,
};

export default descriptor;

export async function makeRequest(
  resourceId: string,
  user: User,
  matchResourceIdExact: boolean
) {
  const resp = await fetch(`${documentStoreUrl}/${resourceId}`, {
    method: "get",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${user?.idToken}`,
    },
  });

  if (!resp.ok) {
    console.warn(`CloudSource process results an error: ${resp.statusText}`);
    return null;
  }

  const contentType = resp.headers.get("content-type");
  if (contentType?.indexOf("application/json") !== -1) {
    const results = await resp.json();
    if (!Array.isArray(results)) {
      console.warn(`Unexpected response format: ${JSON.stringify(results)}`);
      return null;
    }
    if (matchResourceIdExact) {
      return results.slice(-1)[0]?.data || undefined;
    }
    return results.map(({ /*userId,*/ resourceId, data }) => ({
      resourceId,
      data,
    }));
  } else if (contentType.indexOf("text/plain") !== -1) {
    return await resp.text();
  }

  console.warn(`CloudSource received unsupported content type: ${contentType}`);
  return null;
}
