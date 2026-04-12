import { useState, useRef, useEffect } from "react";
import { SquareCode } from "lucide-react";

import { s, t } from "../../../styles";
import Editor, { EditorHandle } from "../../../components/shared/Editor/index";
import DropZone from "../../../components/shared/DropZone";

import { Debouncer } from "./helpers";
import {
  CustomMenuEntry,
  ServiceInstance,
  ServiceUIProps,
} from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import Button from "hkp-frontend/src/ui-components/Button";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";
import { Progress } from "hkp-frontend/src/ui-components/primitives/progress";

type InjectorMode = "data" | "file" | "drop";

export default function InjectorUI(props: ServiceUIProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [dropName, setDropName] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Array<any> | null>(null);
  const [itemsSelection, setItemsSelection] = useState<Array<any>>([]);
  const [recentInjection, setRecentInjection] = useState<string>("");
  const [fileProgress, setFileProgress] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [loadAsText, setLoadAsText] = useState<boolean>(true);
  const [mode, setMode] = useState<InjectorMode>("data");
  const [plainText, setPlainText] = useState<boolean>(false);

  const buttonStyle = {
    width: "100%",
    marginTop: 5,
  };

  const debouncerRef = useRef<Debouncer>(new Debouncer(100));
  const editorRef = useRef<EditorHandle | null>(null);

  useEffect(() => {
    return () => {
      debouncerRef.current.clear();
    };
  }, []);

  const onUpdate = (config: any) => {
    const { recentInjection: ri, plainText: pt } = config;
    if (ri !== undefined) {
      const data = typeof ri === "string" ? ri : JSON.stringify(ri);
      setRecentInjection(data);
    }

    if (pt !== undefined) {
      setPlainText(pt);
    }
  };

  const onInit = (initialState: any) => onUpdate(initialState);

  const onNotification = (notification: any) => onUpdate(notification);

  const getDroppedItemLabels = () => {
    if (!items) {
      return (
        <div
          style={{
            width: "100%",
            minHeight: 80,
            paddingTop: 30,
            fontSize: 20,
            letterSpacing: 1,
            fontWeight: "bold",
          }}
        >
          {dropName ? dropName : "Drop Zone"}
        </div>
      );
    }
    return (
      <ul
        style={{
          textAlign: "left",
          listStyleType: "none",
          paddingLeft: 15,
        }}
      >
        {items.map((item: any, idx: number) => (
          <li key={`drop-zone-item-${idx}`}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                marginBottom: 3,
              }}
            >
              <Checkbox
                key={`drop-zone-item-checkbox-${idx}`}
                onChange={(checked) =>
                  setItemsSelection(
                    checked
                      ? [...itemsSelection, idx]
                      : itemsSelection.filter((x) => x !== idx),
                  )
                }
              />
              <div
                style={{
                  marginLeft: 5,
                  marginTop: -2,
                  letterSpacing: 1,
                  fontSize: 12,
                }}
              >
                {item.type}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const renderDragNDropInput = (service: ServiceInstance) => {
    return (
      <div className="flex flex-col gap-2 h-full w-full">
        <DropZone
          style={{ height: "100%", width: "100%" }}
          label={getDroppedItemLabels()}
          onFiles={(fileList: FileList) => {
            const isArray = fileList.length > 1;
            if (isArray) {
              console.warn(
                "InjectorUI.renderDragNDropInput only single files supported",
              );
              return;
            }
            const b: any = isArray ? Array.from(fileList) : fileList[0];
            const dn = isArray ? "multiple files" : b.name;
            setBlob(b);
            setDropName(dn);
            setItems(null);
          }}
          // onItems={(items: DataTransferItemList) => setItems(items)}
        />
        <Button
          onClick={() => {
            if (blob) {
              readFile(service, blob, false);
            } else {
              service.configure({
                inject: itemsSelection.map((idx) => items?.[idx]),
              });
            }
          }}
          disabled={!itemsSelection.length && !(blob || dropName)}
        >
          Inject
        </Button>
      </div>
    );
  };

  const renderDataEditor = (service: ServiceInstance) => {
    const doInject = () => {
      const code = editorRef.current?.getValue();
      if (plainText) {
        service.configure({ inject: code });
      } else {
        try {
          const obj = JSON.parse(code);
          service.configure({ inject: obj });
        } catch (err) {
          console.error("InjectorUI.renderDataEditor", err);
          service.configure({ inject: code });
        }
      }
      setRecentInjection(code);
    };

    return (
      <div
        className="flex flex-col h-full w-full"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            doInject();
          }
        }}
      >
        <div style={{ height: "calc(100% - 54px)" }}>
          <Editor
            ref={(editor) => { editorRef.current = editor; }}
            value={recentInjection}
            language={plainText ? "text" : "json"}
          />
        </div>

        <Button
          className="h-[50px] mb-[4px]"
          style={buttonStyle}
          onClick={doInject}
        >
          Inject Data
        </Button>
      </div>
    );
  };

  const readFile = (
    service: ServiceInstance,
    f: File | Blob,
    asText: boolean,
  ) => {
    const reader = new FileReader();
    reader.addEventListener("error", (_ev: any) => {
      console.log("Error Injector.readFile", reader.error);
    });
    reader.addEventListener("loadend", (_ev: any) => {
      const result = asText
        ? reader.result
        : new Blob([reader.result!], { type: "application/octet-stream" });
      service.app.next(service, result);
      setFileProgress(0);
    });
    reader.addEventListener("progress", (ev) => {
      const fp = Math.round((ev.loaded / ev.total) * 100);
      setFileProgress(fp);
    });
    if (asText) {
      reader.readAsText(f);
    } else {
      reader.readAsArrayBuffer(f);
    }
  };

  const renderFileInput = (service: ServiceInstance) => {
    return (
      <div className="flex flex-col h-full gap-2">
        <div className="grid w-full items-center gap-1.5 text-left mt-2">
          <Label htmlFor="file" className="text-base">
            Select a file for injection
          </Label>
          <input
            id="file"
            type="file"
            className="tracking-wider"
            onChange={(ev) =>
              ev.target.files?.length && setFile(ev.target.files[0])
            }
          />
        </div>

        <div className="mb-2 h-full">
          <Button
            className="h-full text-xl"
            style={buttonStyle}
            disabled={!file}
            onClick={() => file && readFile(service, file, loadAsText)}
          >
            Inject
          </Button>
        </div>

        <div style={s(t.m(0, 3), { display: fileProgress <= 0 && "none" })}>
          <Progress value={fileProgress} />
        </div>
      </div>
    );
  };

  const onMode = (newMode: string) => {
    setMode(newMode as InjectorMode);
  };

  const onFormatCode = () => {
    const code = editorRef.current?.getValue();
    try {
      const obj = JSON.parse(code);
      setRecentInjection(JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error("InjectorUI.onFormatCode", err);
    }
  };

  const setTextMode = (textMode: boolean) => {
    props.service.configure({ plainText: textMode });
  };

  const { service } = props;
  const customMenuEntries: Array<CustomMenuEntry> = (() => {
    if (mode === "data") {
      return [
        {
          name: "Prettify",
          icon: <MenuIcon icon={SquareCode} />,
          disabled: plainText,
          onClick: onFormatCode,
        },
      ];
    }
    return [];
  })();

  const modes: Array<InjectorMode> = ["data", "file", "drop"];

  const formatOptions =
    mode === "data"
      ? ["json", "plain"]
      : mode === "file"
        ? ["binary", "text"]
        : [];
  const formatValue =
    mode === "data"
      ? plainText
        ? "plain"
        : "json"
      : mode === "file"
        ? loadAsText
          ? "text"
          : "binary"
        : undefined;

  const onFormat = (newFormat: string) => {
    if (mode === "data") {
      setTextMode(newFormat === "plain");
    } else if (mode === "file") {
      setLoadAsText(newFormat === "text");
    }
  };
  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
      initialSize={{ width: 380, height: 280 }}
    >
      <>
        <div className="flex w-full">
          <RadioGroup
            className="w-full"
            title="Mode"
            value={mode}
            options={modes}
            onChange={onMode}
          />
          <RadioGroup
            alignRight={true}
            title="Format"
            value={formatValue}
            options={formatOptions}
            onChange={onFormat}
            disabled={formatOptions.length === 0}
          />
        </div>
        {mode === "data" && renderDataEditor(service)}
        {mode === "file" && renderFileInput(service)}
        {mode === "drop" && renderDragNDropInput(service)}
      </>
    </ServiceUI>
  );
}
