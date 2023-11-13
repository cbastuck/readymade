import ServiceUI from "../services/ServiceUI";
import InputField from "../../components/shared/InputField";
import { ServiceImpl } from "../../types";
import { useEffect, useState } from "react";

type Props = { service: ServiceImpl };

export default function GenericServiceUI({ service }: Props) {
  const [properties, setProperties] = useState<any>(extractProperties(service));

  useEffect(() => setProperties(extractProperties(service)), [service]);

  const renderMain = (service: ServiceImpl) => {
    return (
      <div key={service.uuid} id={service.uuid} style={{ minWidth: 200 }}>
        {Object.keys(properties).map((prop) => {
          const val = properties[prop];
          const t = typeof val;
          return (
            <InputField
              key={`RemoteSerivceUI-${service.uuid}.${prop}`}
              label={prop}
              labelStyle={{ textTransform: "none" }}
              value={val}
              onChange={(_, { value }) => {
                service.configure({ [prop]: value });
              }}
              type={t === "string" ? "text" : (t as any)}
            />
          );
        })}
      </div>
    );
  };

  const onInit = () => {};
  const onNotification = () => {};
  return (
    <ServiceUI
      service={service}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "Main", render: renderMain }]}
    />
  );
}

function extractProperties(service: any) {
  if (!service) {
    return {};
  }

  return Object.keys(service)
    .filter(
      (key) => ["uuid", "serviceId", "serviceName", "board"].indexOf(key) === -1
    )
    .reduce((all, key) => {
      const val = service[key];
      const t = typeof val;
      return t === "string"
        ? {
            ...all,
            [key]: val,
          }
        : all;
    }, {});
}
