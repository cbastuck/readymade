import { useCallback, useContext, useState } from "react";

import { ServiceInstance, ServiceUIProps } from "../../../types";
import InputField from "../../../components/shared/InputField";

import { AppCtx } from "../../../AppContext";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Checkbox from "hkp-frontend/src/ui-components/Checkbox";

type Config = {
  resourceType: string;
  resourceId: string;
  conflictStrategy: string;
};

export default function CloudSinkUI(props: ServiceUIProps) {
  const [resourceId, setResourceId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [conflictStrategy, setConflictStrategy] = useState("");
  const context = useContext(AppCtx);
  const user = context?.user;

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
    [onUpdate],
  );

  const onNotification = useCallback(
    (notification: Partial<Config>) => onUpdate(notification),
    [onUpdate],
  );

  const renderUserMissing = () => {
    return (
      <div style={{ height: "100%" }}>
        <span>This service requires you to login</span>
      </div>
    );
  };

  const renderMain = (service: ServiceInstance) => {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <InputField
          label="Resource-Type"
          disabled={true}
          value={resourceType}
          onChange={(value) => service.configure({ resourceType: value })}
        />
        <InputField
          label="Resource-Id"
          value={resourceId}
          onChange={(value) => service.configure({ resourceId: value })}
        />
        <div
          style={{ display: "flex", flexDirection: "row", marginTop: "2px" }}
        >
          <Checkbox
            title="Replace resource if exists"
            checked={conflictStrategy === "overwrite"}
            onChange={(checked) =>
              service.configure({
                conflictStrategy: checked ? "overwrite" : "skip",
              })
            }
          />
        </div>
      </div>
    );
  };

  const panel = user ? renderMain : renderUserMissing;

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      {panel(props.service)}
    </ServiceUI>
  );
}
