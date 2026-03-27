import { ServiceUIProps } from "hkp-frontend/src/types";
import RealtimeRuntimeServiceUI from "../RealtimeRuntimeServiceUI";
import SelectorField, {
  OnChangeValue,
} from "hkp-frontend/src/components/shared/SelectorField";
import { useCallback, useMemo, useState } from "react";
import InputField from "hkp-frontend/src/components/shared/InputField";
import HttpHeaders from "./HttpHeaders";

export default function HttpClientUI(props: ServiceUIProps) {
  const [url, setUrl] = useState<string>("");
  const [method, setMethod] = useState<string>("get");

  const userAgentOptions = useMemo<Record<string, string>>(
    () => ({
      chrome_windows:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      chrome_mac:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      chrome_linux:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      firefox_windows:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
      firefox_mac:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
      firefox_linux:
        "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
      safari_mac:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
      safari_ios:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
      edge_windows:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      custom:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15",
    }),
    []
  );
  const [userAgent, setUserAgent] = useState<string>("custom");
  const [headers, setHeaders] = useState<
    Array<{ id: string; key: string; value: string }>
  >([]);
  const [body, setBody] = useState<string>("");

  const onUpdate = useCallback(
    (message: any) => {
      if (message.url !== undefined) {
        setUrl(message.url);
      }
      if (message.method !== undefined) {
        setMethod(message.method);
      }
      if (message.userAgent !== undefined) {
        const userAgantKey = Object.entries(userAgentOptions).find(
          ([, uaString]) => uaString === message.userAgent
        )?.[0];
        if (userAgantKey) {
          setUserAgent(userAgantKey);
        } else {
          setUserAgent("custom");
        }
      }
      if (message.headers !== undefined) {
        const headersArray = Object.entries(message.headers).map(
          ([key, value], index) => ({
            id: `${Date.now()}-${index}`,
            key,
            value: value as string,
          })
        );
        setHeaders(headersArray);
      }
      if (message.body !== undefined) {
        setBody(message.body);
      }
    },
    [userAgentOptions]
  );

  const methodOptions = useMemo(
    () => ({
      get: "GET",
      post: "POST",
      put: "PUT",
      delete: "DELETE",
    }),
    []
  );

  const onChangeUrl = (value: string) => {
    setUrl(value);
    props.service.configure({ url: value });
  };

  const onChangeMethod = (value: OnChangeValue) => {
    setMethod(value.value);
    props.service.configure({ method: value.value });
  };

  const onChangeUserAgent = useCallback(
    (value: OnChangeValue) => {
      const userAgentKey = value.value;
      const userAgentString =
        userAgentOptions[userAgentKey] || userAgentOptions.custom;
      setUserAgent(value.value);
      props.service.configure({ userAgent: userAgentString });
    },
    [props.service, userAgentOptions]
  );

  const addHeader = useCallback(() => {
    const newHeader = {
      id: `${Date.now()}`,
      key: "content-type",
      value: "",
    };
    setHeaders((prevHeaders) => [...prevHeaders, newHeader]);
  }, []);

  const removeHeader = useCallback(
    (id: string) => {
      setHeaders((prevHeaders) => {
        const updatedHeaders = prevHeaders.filter((h) => h.id !== id);
        const headersObj = updatedHeaders.reduce((acc, h) => {
          if (h.key && h.value) {
            acc[h.key] = h.value;
          }
          return acc;
        }, {} as Record<string, string>);
        props.service.configure({ headers: headersObj });
        return updatedHeaders;
      });
    },
    [props.service]
  );

  const updateHeaderKey = useCallback(
    (id: string, value: OnChangeValue) => {
      setHeaders((prevHeaders) => {
        const updatedHeaders = prevHeaders.map((h) =>
          h.id === id ? { ...h, key: value.value } : h
        );
        // Only configure if this header has a value
        const header = updatedHeaders.find((h) => h.id === id);
        if (header && header.value) {
          const headersObj = updatedHeaders.reduce((acc, h) => {
            if (h.key && h.value) {
              acc[h.key] = h.value;
            }
            return acc;
          }, {} as Record<string, string>);
          props.service.configure({ headers: headersObj });
        }
        return updatedHeaders;
      });
    },
    [props.service]
  );

  const updateHeaderValue = useCallback(
    (id: string, value: string) => {
      setHeaders((prevHeaders) => {
        const updatedHeaders = prevHeaders.map((h) =>
          h.id === id ? { ...h, value } : h
        );
        // Only configure if value is not empty or if we're clearing a previously set value
        const headersObj = updatedHeaders.reduce((acc, h) => {
          if (h.key && h.value) {
            acc[h.key] = h.value;
          }
          return acc;
        }, {} as Record<string, string>);
        props.service.configure({ headers: headersObj });
        return updatedHeaders;
      });
    },
    [props.service]
  );

  const onChangeBody = (value: string) => {
    console.log("HttpClientUI.onChangeBody", value);
    setBody(value);
    props.service.configure({ body: value });
  };

  return (
    <RealtimeRuntimeServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-500">
          <div className="py-1 w-[25rem] flex gap-2">
            <InputField label="URL" value={url} onChange={onChangeUrl} />
            <div className="w-min">
              <SelectorField
                value={method}
                label=""
                options={methodOptions}
                onChange={onChangeMethod}
                labelStyle={{
                  textTransform: "capitalize",
                  textAlign: "left",
                }}
              />
            </div>
          </div>
          <div className="w-[25rem]">
            <SelectorField
              value={userAgent}
              label="UserAgent"
              options={userAgentOptions}
              onChange={onChangeUserAgent}
              labelStyle={{
                textTransform: "capitalize",
                textAlign: "left",
              }}
            />
          </div>
          <div className="py-1">
            <HttpHeaders
              headers={headers}
              onAddHeader={addHeader}
              onRemoveHeader={removeHeader}
              onUpdateHeaderValue={updateHeaderValue}
              onUpdateHeaderKey={updateHeaderKey}
            />
          </div>
          <div className="flex flex-col gap-1 py-2">
            <h3 className="font-medium text-left tracking-[4px]">Body</h3>
            <textarea
              className={`w-full  p-2 text-sm border border-gray-300 rounded bg-gray-50 font-mono ${
                method === "get" ? "opacity-50 cursor-not-allowed" : ""
              }`}
              value={body}
              onChange={(e) => onChangeBody(e.target.value)}
              placeholder="Request body content"
              disabled={method === "get"}
            />
          </div>
        </div>
      </div>
    </RealtimeRuntimeServiceUI>
  );
}
