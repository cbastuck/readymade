import { useCallback, useState } from "react";
import { Checkbox, Label } from "semantic-ui-react";

import ServiceUI from "../../services/ServiceUI";
import { AppImpl, ServiceClass, ServiceImpl } from "../../../types";
import InputField from "../../../components/shared/InputField";
import moment from "moment";

const serviceId = "hookup.to/service/cloud-sink";
const serviceName = "Cloud-Sink";

const documentStoreUrl = "https://cloud.hookup.to/store/document";

type Props = {};
type Config = {
  resourceType: string;
  resourceId: string;
  conflictStrategy: string;
};

function CloudSinkUI(props: Props) {
  const [resourceId, setResourceId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [conflictStrategy, setConflictStrategy] = useState("");

  const onUpdate = useCallback((update: Partial<Config>) => {
    const { resourceType, resourceId, conflictStrategy } = update;
    if (resourceId !== undefined) {
      setResourceId(resourceId);
    }
    if (resourceType !== undefined) {
      setResourceType(resourceType);
    }
    if (conflictStrategy !== undefined) {
      setConflictStrategy(conflictStrategy);
    }
  }, []);

  const onInit = useCallback(
    (initialState: Partial<Config>) => onUpdate(initialState),
    [onUpdate]
  );

  const onNotification = useCallback(
    (service: CloudSink, notification: Partial<Config>) =>
      onUpdate(notification),
    [onUpdate]
  );

  const renderMain = (service: ServiceImpl) => {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <InputField
          label="Resource-Type"
          disabled={true}
          value={resourceType}
          onChange={(_, { value }) =>
            service.configure({ resourceType: value })
          }
        />
        <InputField
          label="Resource-Id"
          value={resourceId}
          onChange={(_, { value }) => service.configure({ resourceId: value })}
        />
        <div
          style={{ display: "flex", flexDirection: "row", marginTop: "2px" }}
        >
          <Label
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              marginRight: "5px",
            }}
          >
            Replace resource if exists
          </Label>
          <div style={{ marginTop: 5 }}>
            <Checkbox
              checked={conflictStrategy === "overwrite"}
              onChange={(_, { checked }) =>
                service.configure({
                  conflictStrategy: checked ? "overwrite" : "skip",
                })
              }
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "main", render: renderMain }]}
    />
  );
}

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
    descriptor: ServiceClass,
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
      const resp = await fetch(
        `${documentStoreUrl}/${this.resourceId}?conflictStrategy=${this.conflictStrategy}`,
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
