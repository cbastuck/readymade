import { useCallback, useContext, useState } from "react";
import { Checkbox, Label } from "semantic-ui-react";

import ServiceUI from "../../services/ServiceUI";
import { AppImpl, ServiceClass, ServiceImpl } from "../../../types";
import InputField from "../../../components/shared/InputField";
import Button from "../../../components/shared/Button";

import { AppCtx } from "../../../AppContext";

const serviceId = "hookup.to/service/cloud-source";
const serviceName = "Cloud-Source";

type Props = {};
type Config = {
  resourceType: string;
  resourceId: string;
  matchResourceIdExact: boolean;
  command: { action: string };
};

const documentStoreUrl = "https://cloud.hookup.to/store/document";

function CloudSourceUI(props: Props) {
  const [resourceId, setResourceId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [matchResourceIdExact, setMatchResourceIdExact] = useState(true);

  const context = useContext(AppCtx);
  const user = context?.user;

  const onUpdate = useCallback((update: Partial<Config>) => {
    const { resourceType, resourceId, matchResourceIdExact } = update;
    if (resourceId !== undefined) {
      setResourceId(resourceId);
    }
    if (resourceType !== undefined) {
      setResourceType(resourceType);
    }
    if (matchResourceIdExact !== undefined) {
      setMatchResourceIdExact(matchResourceIdExact);
    }
  }, []);

  const onInit = useCallback(
    (initial: Partial<Config>) => onUpdate(initial),
    [onUpdate]
  );

  const onNotification = useCallback(
    (service: CloudSource, notification: Partial<Config>) =>
      onUpdate(notification),
    [onUpdate]
  );

  const renderUserMissing = () => {
    return (
      <div style={{ height: "100%" }}>
        <span>This service requires you to login</span>
      </div>
    );
  };

  const renderMain = (service: ServiceImpl) => (
    <div>
      <InputField
        label="Resource-Type"
        disabled={true}
        value={resourceType}
        onChange={(_, { value }) => service.configure({ resourceType: value })}
      />
      <InputField
        label="Resource-Id"
        value={resourceId}
        onChange={(_, { value }) => service.configure({ resourceId: value })}
      />
      <div style={{ display: "flex", flexDirection: "row", marginTop: "5px" }}>
        <Label
          style={{
            fontSize: 12,
            marginRight: "5px",
          }}
        >
          Only exact resource match
        </Label>
        <div style={{ marginTop: 5 }}>
          <Checkbox
            checked={matchResourceIdExact}
            onChange={(_, { checked }) =>
              service.configure({
                matchResourceIdExact: checked,
              })
            }
          />
        </div>
      </div>
      <Button
        style={{
          width: "100%",
          fontSize: 12,
          letterSpacing: 1,
          marginTop: "5px",
        }}
        onClick={() =>
          service.configure({
            command: {
              action: "retrieve",
            },
          })
        }
        disabled={!resourceId}
      >
        Retrieve
      </Button>
    </div>
  );

  const panel = user ? renderMain : renderUserMissing;
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "main", render: panel }]}
    />
  );
}

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
    descriptor: ServiceClass,
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

  doProcess = async (params: any) => {
    const user = this.app.getAuthenticatedUser();
    if (!this.resourceId || !user) {
      return null;
    }
    const resp = await fetch(`${documentStoreUrl}/${this.resourceId}`, {
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
      if (this.matchResourceIdExact) {
        return results.slice(-1)[0]?.data || undefined;
      }
      return results.map(({ userId, resourceId, data }) => ({
        resourceId,
        data,
      }));
    } else if (contentType.indexOf("text/plain") !== -1) {
      return await resp.text();
    }

    console.warn(
      `CloudSource received unsupported content type: ${contentType}`
    );
    return null;
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
