import { useEffect, useState } from "react";
import { Copy } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "../../types";

import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import InputText from "../../components/shared/InputText";
import Slider from "../../components/shared/Slider";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import Switch from "hkp-frontend/src/ui-components/Switch";

type Props = ServiceUIProps & {
  onNotification?: (notification: any) => void;
  onInit?: (state: any) => void;
  children?: any;
  genericUI?: boolean;
};
export default function RealtimeRuntimeServiceUI(props: Props) {
  const { service, onNotification } = props;
  const meta = service.state?.["__meta__"];
  const [properties, setProperties] = useState<any>(extractProperties(service));

  useEffect(() => setProperties(extractProperties(service)), [service]);

  useEffect(() => {
    console.debug(
      `RealtimeRuntimeServiceUI: '${service.serviceName}' state changed`,
      service.state
    );
    onNotification?.(service.state);
  }, [properties, service.state, service.serviceName, onNotification]);
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
                labelClassName="tracking-[1px] text-base2"
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
            t === "string" ? (visibility === "hide" ? "password" : "text") : t;

          return (
            <div
              className="flex items-end"
              key={`RealtimeRuntimeServiceUI-${service.uuid}.${prop}`}
            >
              <SubmittableInput
                labelClassName="tracking-[1px]"
                fullWidth
                title={prop}
                value={renderValueWithType(val, type)}
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

  return (
    <ServiceUI
      {...props}
      service={service}
      onInit={props.onInit}
      onNotification={props.onNotification}
      showBypassOnlyIfExplicit={true}
    >
      {props.genericUI === false ? props.children : renderMain(service)}
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
      if (Array.isArray(val)) {
        const arr: { [k: string]: string } = {};
        val.forEach((v, i) => {
          if (v !== undefined) {
            arr[`${key}[${i}]`] = v;
          }
        });
        return { ...all, ...arr };
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

function renderValueWithType(value: any, type: string) {
  if (type === "number") {
    return value.toString();
  }
  if (type === "boolean") {
    return value ? "true" : "false";
  }
  if (type === "string") {
    return value;
  }
  if (type === "object") {
    return JSON.stringify(value);
  }
  return value;
}
