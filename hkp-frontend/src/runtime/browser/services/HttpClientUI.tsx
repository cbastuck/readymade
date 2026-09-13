import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import Editor from "hkp-frontend/src/components/shared/Editor";
import MappingTable, { Template } from "../../../components/MappingTable";
import { MOUNT_SCHEME } from "hkp-frontend/src/runtime/board/mount";
import { METHODS } from "./http-client-methods";

/**
 * The browser HTTP Client's panel.
 *
 * Composes the request in the order it is read — where it goes, what verb, what
 * travels with it — and sends it on demand, because a client that is not wired
 * behind anything still has to be tryable.
 *
 * The method is stored lower case, as every runtime's client stores it, and
 * shown as the verb it is.
 */

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
  METHODS.map((method) => [method, method.toUpperCase()]),
);

export default function HttpClientUI(props: ServiceUIProps) {
  const [url, setUrl] = useState("");
  const [mount, setMount] = useState("");
  const [path, setPath] = useState("");
  const [method, setMethod] = useState<string>("get");
  const [query, setQuery] = useState<Template>({});
  const [headers, setHeaders] = useState<Template>({});
  const [body, setBody] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("10000");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const update = (config: any) => {
    if (config?.url !== undefined && needsUpdate(config.url, url)) {
      setUrl(config.url);
    }
    if (
      config?.__hkpMount !== undefined &&
      needsUpdate(config.__hkpMount, mount)
    ) {
      setMount(config.__hkpMount);
    }
    if (config?.path !== undefined && needsUpdate(config.path, path)) {
      setPath(config.path);
    }
    if (config?.method !== undefined && needsUpdate(config.method, method)) {
      setMethod(config.method);
    }
    if (config?.query !== undefined && needsUpdate(config.query, query)) {
      setQuery(config.query);
    }
    if (config?.headers !== undefined && needsUpdate(config.headers, headers)) {
      setHeaders(config.headers);
    }
    if (config?.body !== undefined && needsUpdate(config.body, body)) {
      setBody(config.body);
    }
    if (config?.timeoutMs !== undefined) {
      const value = String(config.timeoutMs);
      if (needsUpdate(value, timeoutMs)) {
        setTimeoutMs(value);
      }
    }
    // What a request is doing, and what came of the last one. Reported on every
    // outcome, so what is shown is this request's rather than an older
    // failure's still standing.
    if (config?.requesting === true) {
      setStatus("requesting…");
    } else if (config?.status !== undefined) {
      setStatus(String(config.status));
    }
    if (config?.error !== undefined) {
      setError(config.error);
    }
  };

  const configure = (config: any) => props.service.configure(config);

  const onChangeTimeout = (value: string) => {
    setTimeoutMs(value);
    const parsed = Number(value);
    if (parsed > 0) {
      configure({ timeoutMs: parsed });
    }
  };

  // Begins at this service: it makes the request and calls the rest of the
  // pipeline itself once the response arrives.
  const onSend = () => props.service.process(undefined);

  return (
    <ServiceUI
      {...props}
      onInit={update}
      onNotification={update}
      initialSize={{ width: 400, height: undefined }}
    >
      <div
        className="h-full flex flex-col my-2 gap-2"
        style={{ width: "100%", textAlign: "left" }}
      >
        {mount ? (
          // The board points this service at a service that owns an endpoint
          // rather than at an address. Read-only: the address is assigned by a
          // runtime and resolved by the board's coordinator, so it is not the
          // user's to type, and it takes precedence over URL.
          <div>
            <GroupLabel className="hkp-svc-field-label" size={4}>
              Mount
            </GroupLabel>
            <div className="font-mono text-xs break-all">
              {mount}
              {mount.startsWith(MOUNT_SCHEME) && (
                <span className="italic"> — waiting for an endpoint</span>
              )}
            </div>
          </div>
        ) : null}

        <InputField
          value={url}
          label="URL"
          onChange={(value) => configure({ url: value })}
          isExpandable
        />

        <InputField
          value={path}
          label="Path"
          onChange={(value) => configure({ path: value })}
        />

        <PillRadioGroup
          title="Method"
          options={METHOD_LABELS}
          value={method}
          onChange={(value) => configure({ method: value })}
        />

        <MappingTable
          id={`${props.service.uuid}-query`}
          title="Query"
          template={query}
          onTemplateChanged={(template) => configure({ query: template })}
        />

        <MappingTable
          id={`${props.service.uuid}-headers`}
          title="Headers"
          template={headers}
          onTemplateChanged={(template) => configure({ headers: template })}
        />

        <div className="flex flex-col gap-1">
          <GroupLabel className="hkp-svc-field-label" size={4}>
            Body
          </GroupLabel>
          <div className="h-[100px] w-full">
            <Editor
              value={body}
              onChange={(value) => configure({ body: value || "" })}
              language="json"
            />
          </div>
          <div className="text-xs opacity-60">
            {method === "get"
              ? "Not sent with GET."
              : "Sent when nothing came down the pipeline."}
          </div>
        </div>

        <InputField
          value={timeoutMs}
          label="Timeout"
          unit="ms"
          onChange={onChangeTimeout}
        />

        <Button className="hkp-svc-btn w-full" onClick={onSend}>
          Send
        </Button>

        {status || error ? (
          <div className="text-xs">
            <span className="opacity-60">{status}</span>
            {error ? <span style={{ color: "#ef4444" }}> {error}</span> : null}
          </div>
        ) : null}
      </div>
    </ServiceUI>
  );
}
