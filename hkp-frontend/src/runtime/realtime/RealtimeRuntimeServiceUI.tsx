import { useEffect, useState } from "react";
import { Copy } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "../../types";

import SelectorField from "@/components/shared/SelectorField";
import InputText from "../../components/shared/InputText";
import Slider from "../../components/shared/Slider";
import ServiceUI from "@/ui-components/service/ServiceUI";
import Button from "@/ui-components/Button";
import SubmittableInput from "@/ui-components/SubmittableInput";
import Switch from "@/ui-components/Switch";

type Props = ServiceUIProps & {
  onNotification?: (notification: any) => void;
  children?: any;
};
export default function RealtimeRuntimeServiceUI(props: Props) {
  const { service } = props;
  const meta = service.state?.["__meta__"];
  const [properties, setProperties] = useState<any>(extractProperties(service));

  useEffect(() => setProperties(extractProperties(service)), [service]);

  const renderMain = (service: ServiceInstance) => {
    return (
      <div
        key={service.uuid}
        id={service.uuid}
        style={{ minWidth: 200, paddingBottom: 12 }}
      >
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
                key={`RealtimeRuntimeServiceUI-${service.uuid}.${prop}`}
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

          if (!metaInfo && t === "boolean") {
            return (
              <Switch
                className="py-2"
                key={prop}
                title={prop}
                checked={val}
                onCheckedChange={() => service.configure({ [prop]: !val })}
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
            <div
              className="flex items-end"
              key={`RealtimeRuntimeServiceUI-${service.uuid}.${prop}`}
            >
              <SubmittableInput
                fullWidth
                title={prop}
                value={val}
                onSubmit={(value) => {
                  service.configure({
                    [prop]: type === "number" ? Number(value) : value,
                  });
                }}
                type={type}
                disabled={readonly}
              />
              {readonly && (
                <Button
                  className="h-min w-min"
                  variant="ghost"
                  icon={<Copy size={14} />}
                  onClick={() => navigator.clipboard.writeText(val)}
                />
              )}
            </div>
          );
        })}
        {props.children || null}
      </div>
    );
  };

  const onInit = () => {};
  const onNotification = (notification: any) => {
    props.onNotification?.(notification);
  };
  return (
    <ServiceUI
      {...props}
      service={service}
      onInit={onInit}
      onNotification={onNotification}
      showBypassOnlyIfExplicit={true}
    >
      {renderMain(service)}
    </ServiceUI>
  );
}

function extractProperties(service: any) {
  if (!service) {
    return {};
  }

  const src = service.state || {};
  return Object.keys(src)
    .filter(
      (key) =>
        ["uuid", "serviceId", "serviceName", "board", "bypass"].indexOf(key) ===
        -1
    )
    .reduce((all, key) => {
      const val = src[key];
      const t = typeof val;
      if (t === "string" || t === "number" || t === "boolean") {
        return { ...all, [key]: val };
      }
      if (t === "object") {
        const obj: { [k: string]: string } = {};
        for (const k in val) {
          if (val[k] !== undefined) {
            obj[`${key}.${k}`] = val[k];
          }
        }
        return { ...all, ...obj };
      }
      return all;
    }, {});
}
