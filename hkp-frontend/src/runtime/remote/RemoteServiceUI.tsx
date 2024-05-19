import { useEffect, useState } from "react";
import { Copy } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "../../types";

import SelectorField from "../../components/shared/SelectorField";
import InputText from "../../components/shared/InputText";
import Slider from "../../components/shared/Slider";
import ServiceUI from "@/ui-components/service/ServiceUI";
import Button from "@/ui-components/Button";
import SubmittableInput from "@/ui-components/SubmittableInput";

export default function RemoteServiceUI(props: ServiceUIProps) {
  const { service } = props;
  const meta = service["__meta__"];
  const [properties, setProperties] = useState<any>(extractProperties(service));

  useEffect(() => setProperties(extractProperties(service)), [service]);

  const renderMain = (service: ServiceInstance) => {
    return (
      <div key={service.uuid} id={service.uuid} style={{ minWidth: 200 }}>
        {Object.keys(properties).map((prop) => {
          const val = properties[prop];
          const t = typeof val;
          const metaInfo = meta && meta[prop];
          if (metaInfo && metaInfo.type === "number") {
            if (
              metaInfo.data.minValue !== undefined &&
              metaInfo.data.maxValue !== undefined
            ) {
              return (
                <Slider
                  key={prop}
                  minValue={Number(metaInfo.data.minValue)}
                  maxValue={Number(metaInfo.data.maxValue)}
                  value={Number(val)}
                  label={prop}
                  onChange={(_, { value }) => {
                    service.configure({ [prop]: value });
                  }}
                  labelStyle={{ textTransform: "capitalize", letterSpacing: 1 }}
                />
              );
            }
          }
          if (metaInfo && metaInfo.type === "enum") {
            const options = metaInfo.data.options.reduce(
              (acc: object, cur: string) => ({ ...acc, [cur]: cur }),
              {}
            );
            return (
              <div key={prop} style={{ marginBottom: 3 }}>
                <SelectorField
                  value={val}
                  label={prop}
                  options={options}
                  onChange={({ value }) => {
                    service.configure({ [prop]: value });
                  }}
                  labelStyle={{
                    textTransform: "capitalize",
                    textAlign: "left",
                  }}
                  uppercaseKeys={false}
                  uppercaseValues={false}
                />
              </div>
            );
          }
          if (
            metaInfo &&
            metaInfo.type === "text" &&
            metaInfo.data.textType === "block"
          ) {
            return (
              <InputText
                key={`RemoteServiceUI-${service.uuid}.${prop}`}
                label={prop}
                labelStyle={{ textTransform: "capitalize" }}
                value={val}
                onChange={(_, { value }) => {
                  service.configure({ [prop]: value });
                }}
                resizeable={false}
              />
            );
          }
          const visibility =
            metaInfo && metaInfo.type === "text" && metaInfo.data.visibility;

          const readonly = visibility === "readonly";

          const type =
            t === "string"
              ? visibility === "hide"
                ? "password"
                : "text"
              : (t as any);

          return (
            <div key={`RemoteServiceUI-${service.uuid}.${prop}`}>
              <SubmittableInput
                title={prop}
                value={val}
                onSubmit={(value) => {
                  service.configure({ [prop]: value });
                }}
                type={type}
                disabled={readonly}
              />
              {readonly && (
                <Button
                  style={{
                    margin: 3,
                    border: "solid 1px rgb(186, 186, 186)",
                  }}
                  icon={<Copy />}
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(val)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const onInit = () => {};
  const onNotification = (_notification: any) => {};

  return (
    <ServiceUI
      {...props}
      service={service}
      onInit={onInit}
      onNotification={onNotification}
    >
      {renderMain(service)}
    </ServiceUI>
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
      if (t === "string" || t === "number") {
        return { ...all, [key]: val };
      }
      return all;
    }, {});
}
