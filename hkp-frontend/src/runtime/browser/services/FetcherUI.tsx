import { useState } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import MappingTable, { Template } from "../../../components/MappingTable";
import Editor from "hkp-frontend/src/components/shared/Editor";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import SelectorField, {
  arrayToOptions,
  OnChangeValue,
} from "hkp-frontend/src/components/shared/SelectorField";
import { BodyFormat } from "./Fetcher";

export default function FetcherUI(props: ServiceUIProps) {
  const [url, setUrl] = useState("");

  const update = (config: any) => {
    if (needsUpdate(config?.url, url)) {
      setUrl(config.url);
    }

    if (needsUpdate(config?.method, method)) {
      setMethod(config.method);
    }

    if (needsUpdate(config?.headers, headers)) {
      setHeaders(config.headers);
    }

    if (needsUpdate(config?.body, body)) {
      setBody(config.body);
    }

    if (needsUpdate(config?.bodyFormat, bodyFormat)) {
      setBodyFormat(config.bodyFormat);
    }
  };

  const onInit = (state: any) => update(state);

  const onNotification = (notification: any) => update(notification);

  const onChangeUrl = (url: string) => props.service.configure({ url });

  const onFetch = () =>
    props.service.configure({
      command: { action: "fetch", params: { isJSON: true } },
    });

  const methods = ["GET", "POST", "PUT", "DELETE"];
  const [method, setMethod] = useState(methods[0]);
  const onMethodChange = (method: string) =>
    props.service.configure({ method });

  const [headers, setHeaders] = useState<Template>({});
  const onHeadersChanged = (headers: Template) => {
    props.service.configure({ headers });
  };

  const [body, setBody] = useState("");
  const onChangeBody = (body: string | undefined) => {
    props.service.configure({ body: body || null });
  };

  const [bodyFormat, setBodyFormat] = useState<BodyFormat>("text");
  const onChangeBodyFormat = ({ value: bodyFormat }: OnChangeValue) =>
    props.service.configure({ bodyFormat });

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <div
        className="h-full flex flex-col my-2 gap-2"
        style={{ width: "100%", textAlign: "left", textOverflow: "ellipsis" }}
      >
        <InputField
          value={url}
          label="URL"
          onChange={onChangeUrl}
          isExpandable
        />

        <RadioGroup
          title="Method"
          options={methods}
          value={method}
          onChange={onMethodChange}
        />

        <MappingTable
          id={props.service.uuid}
          title="Headers"
          template={headers}
          onTemplateChanged={onHeadersChanged}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-end">
            <GroupLabel>Body</GroupLabel>
            <SelectorField
              className="max-w-[100px] ml-auto"
              value={bodyFormat}
              options={arrayToOptions(["json", "text"])}
              onChange={onChangeBodyFormat}
            />
          </div>

          <div className="h-[100px] w-full">
            <Editor
              value={body}
              onChange={onChangeBody}
              language={bodyFormat}
            />
          </div>
        </div>

        <Button className="w-full" onClick={onFetch}>
          Fetch
        </Button>
      </div>
    </ServiceUI>
  );
}
