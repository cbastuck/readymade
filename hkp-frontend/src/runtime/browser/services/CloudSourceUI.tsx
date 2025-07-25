import { useCallback, useContext, useState } from "react";

import { ServiceInstance, ServiceUIProps } from "../../../types";
import InputField from "../../../components/shared/InputField";

import { AppCtx } from "../../../AppContext";
import Checkbox from "hkp-frontend/src/ui-components/Checkbox";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";

type Config = {
  resourceType: string;
  resourceId: string;
  matchResourceIdExact: boolean;
  command: { action: string };
};

export default function CloudSourceUI(props: ServiceUIProps) {
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
    (notification: Partial<Config>) => onUpdate(notification),
    [onUpdate]
  );

  const renderUserMissing = () => {
    return (
      <div style={{ height: "100%" }}>
        <span>This service requires you to login</span>
      </div>
    );
  };

  const renderMain = (service: ServiceInstance) => (
    <div className="flex flex-col gap-2">
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
      <div style={{ display: "flex", flexDirection: "row", marginTop: "5px" }}>
        <div style={{ marginTop: 5 }}>
          <Checkbox
            title="Only exact resource match"
            checked={matchResourceIdExact}
            onChange={(checked) =>
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
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      {panel(props.service)}
    </ServiceUI>
  );
}
