import { useState } from "react";

import InputField from "@/components/shared/InputField";
import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import Button from "@/ui-components/Button";
import RadioGroup from "@/ui-components/RadioGroup";
import MappingTable, { Template } from "../../../components/MappingTable";
import Editor from "@/components/shared/Editor";
import GroupLabel from "@/ui-components/GroupLabel";

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
        <InputField value={url} label="URL" onChange={onChangeUrl} />
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

        <div>
          <GroupLabel>Body</GroupLabel>
          <div className="h-[80px] w-full">
            <Editor value={body} onChange={onChangeBody} />
          </div>
        </div>

        <Button className="w-full" onClick={onFetch}>
          Fetch
        </Button>
      </div>
    </ServiceUI>
  );
}
