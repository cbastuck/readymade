import { Component } from "react";
import { SquareCode } from "lucide-react";

import { s, t } from "../../../styles";
import Editor, { EditorHandle } from "../../../components/shared/Editor/index";
import DropZone from "../../../components/shared/DropZone";

import { Debouncer } from "./helpers";
import {
  CustomMenuEntry,
  ServiceInstance,
  ServiceUIProps,
  User,
} from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import Button from "hkp-frontend/src/ui-components/Button";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";
import { Progress } from "hkp-frontend/src/ui-components/primitives/progress";

type State = {
  files: Array<File>;
  user: User | undefined;
  blob: Blob | null;
  dropName: string | undefined;
  items: Array<any> | null;
  itemsSelection: Array<any>;
  recentInjection: string;
  multirow: boolean;
  fileProgress: number;
  file: File | null;
  loadAsText: boolean;
  mode: InjectorMode;
  plainText: boolean;
};

type InjectorMode = "data" | "file" | "drop";

export default class InjectorUI extends Component<ServiceUIProps, State> {
  state: State = {
    files: [],
    user: undefined,
    blob: null,
    dropName: undefined,
    items: null,
    itemsSelection: [],
    recentInjection: "",
    multirow: false,
    fileProgress: 0,
    file: null,
    loadAsText: true,
    mode: "data",
    plainText: false,
  };

  buttonStyle = {
    width: "100%",
    marginTop: 5,
  };

  debouncer: Debouncer = new Debouncer(100);

  editor: EditorHandle | null = null;

  componentWillUnmount() {
    this.debouncer.clear();
  }

  onUpdate = (config: any) => {
    const { recentInjection, plainText } = config;
    if (recentInjection !== undefined) {
      const data =
        typeof recentInjection === "string"
          ? recentInjection
          : JSON.stringify(recentInjection);
      this.setState({ recentInjection: data });
    }

    if (plainText !== undefined) {
      this.setState({ plainText });
    }
  };

  onInit = (initialState: any) => this.onUpdate(initialState);

  onNotification = (notification: any) => this.onUpdate(notification);

  getDroppedItemLabels = () => {
    const { items, dropName } = this.state;
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
                  this.setState({
                    itemsSelection: checked
                      ? [...this.state.itemsSelection, idx]
                      : this.state.itemsSelection.filter((x) => x !== idx),
                  })
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

  renderDragNDropInput = (service: ServiceInstance) => {
    const { items, itemsSelection, blob, dropName } = this.state;
    return (
      <div className="flex flex-col gap-2 h-full w-full">
        <DropZone
          style={{ height: "100%", width: "100%" }}
          label={this.getDroppedItemLabels()}
          onFiles={(files: FileList) => {
            const isArray = files.length > 1;
            if (isArray) {
              console.warn(
                "InjectorUI.renderDragNDropInput only single files supported"
              );
              return;
            }
            const blob: any = isArray ? Array.from(files) : files[0];
            const dropName = isArray ? "multiple files" : blob.name;
            this.setState({ blob, dropName, items: null });
          }}
          // onItems={(items: DataTransferItemList) => this.setState({ items })}
        />
        <Button
          onClick={() => {
            if (blob) {
              this.readFile(service, blob, false);
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

  renderDataEditor = (service: ServiceInstance) => {
    const { recentInjection, plainText } = this.state;
    return (
      <div className="flex flex-col h-full w-full">
        <div style={{ height: "calc(100% - 54px)" }}>
          <Editor
            ref={(editor) => (this.editor = editor)}
            value={recentInjection}
            language={plainText ? "text" : "json"}
          />
        </div>

        <Button
          className="h-[50px] mb-[4px]"
          style={this.buttonStyle}
          onClick={() => {
            const code = this.editor?.getValue();
            try {
              const obj = JSON.parse(code);
              service.configure({ inject: obj });
            } catch (err) {
              console.error("InjectorUI.renderDataEditor", err);
              service.configure({ inject: code }); // can we check of the text is valid JSON from the editor?
            }
            this.setState({ recentInjection: code });
          }}
        >
          Inject Data
        </Button>
      </div>
    );
  };

  readFile = (
    service: ServiceInstance,
    file: File | Blob,
    loadAsText: boolean
  ) => {
    const reader = new FileReader();
    //reader.addEventListener('loadstart', ev => console.log('loadstart', reader.result));
    //reader.addEventListener('load', ev => console.log('load', reader.result));
    reader.addEventListener("error", (_ev: any) => {
      console.log("Error Injector.readFile", reader.error);
    });
    //reader.addEventListener('abort', ev => console.log('abort', reader.result));
    reader.addEventListener("loadend", (_ev: any) => {
      const result = loadAsText
        ? reader.result
        : new Blob([reader.result!], { type: "application/octet-stream" });
      service.app.next(service, result);
      this.setState({ fileProgress: 0 });
    });
    reader.addEventListener("progress", (ev) => {
      const fileProgress = Math.round((ev.loaded / ev.total) * 100);
      this.setState({ fileProgress });
    });
    if (loadAsText) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  renderFileInput = (service: ServiceInstance) => {
    const { file, loadAsText, fileProgress } = this.state;
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
              ev.target.files?.length &&
              this.setState({ file: ev.target.files[0] })
            }
          />
        </div>

        <div className="mb-2 h-full">
          <Button
            className="h-full text-xl"
            style={this.buttonStyle}
            disabled={!file}
            onClick={() => file && this.readFile(service, file, loadAsText)}
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

  onMode = (newMode: string) => {
    this.setState((state) => ({ ...state, mode: newMode as InjectorMode }));
  };

  onFormatCode = () => {
    const code = this.editor?.getValue();
    try {
      const obj = JSON.parse(code);
      this.setState({
        recentInjection: JSON.stringify(obj, null, 2),
      });
    } catch (err) {
      console.error("InjectorUI.onFormatCode", err);
    }
  };

  setTextMode = (textMode: boolean) => {
    this.props.service.configure({ plainText: textMode });
  };

  render() {
    const { service } = this.props;
    const { mode, plainText, loadAsText } = this.state;
    const customMenuEntries: Array<CustomMenuEntry> = (() => {
      if (mode === "data") {
        return [
          {
            name: "Prettify",
            icon: <MenuIcon icon={SquareCode} />,
            disabled: plainText,
            onClick: this.onFormatCode,
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
        this.setTextMode(newFormat === "plain");
      } else if (mode === "file") {
        this.setState((state) => ({
          ...state,
          loadAsText: newFormat === "text",
        }));
      }
    };
    return (
      <ServiceUI
        {...this.props}
        className="pb-2"
        onInit={this.onInit}
        onNotification={this.onNotification}
        customMenuEntries={customMenuEntries}
        initialSize={{ width: 380, height: 280 }}
      >
        <>
          <div className="flex w-full">
            <RadioGroup
              className="w-full"
              title="Mode"
              value={this.state.mode}
              options={modes}
              onChange={this.onMode}
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
          {mode === "data" && this.renderDataEditor(service)}
          {mode === "file" && this.renderFileInput(service)}
          {mode === "drop" && this.renderDragNDropInput(service)}
        </>
      </ServiceUI>
    );
  }
}
