import { useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import { Button } from "@/components/ui/button";
import GroupLabel from "@/ui-components/GroupLabel";
import RadioGroup from "@/ui-components/RadioGroup";
import SubmittableInput from "@/ui-components/SubmittableInput";

export default function MapUI(props: ServiceUIProps) {
  const { service } = props;
  enum Mode {
    REPLACE = "replace",
    OVERWRITE = "overwrite",
    ADD = "add",
  }

  const [template, setTemplate] = useState<any>({});
  const [mode, setMode] = useState<Mode>(Mode.REPLACE);
  const [isMappingChangePending, setIsMappingChangePending] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const updateState = (newState: any) => {
    if (needsUpdate(newState.mode, mode)) {
      setMode(newState.mode);
    }

    if (needsUpdate(newState.template, template)) {
      setTemplate(newState.template);
    }
  };

  const onInit = (initialState: any) => updateState(initialState);

  const onNotification = (_service: ServiceInstance, notification: any) =>
    updateState(notification);

  const onNewProperty = () => {
    const newKey = "key";
    const keys = Object.keys(template)
      .flatMap((k) => {
        const n = k.startsWith(newKey) && k.slice(newKey.length);
        if (n === "" || !isNaN(Number(n))) {
          return [Number(n)];
        }
        return [];
      })
      .sort((a, b) => Number(a) - Number(b));
    const x = keys.length ? keys.pop() || 0 : null;
    const incKey = x !== null ? newKey + `${x + 1}` : newKey;
    service.configure({
      template: {
        ...template,
        [incKey]: "value",
      },
    });
  };

  const onChangeKey = (key: string, newKey: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) =>
        cur === key
          ? { ...acc, [newKey]: template[cur] }
          : { ...acc, [cur]: template[cur] },
      {}
    );
    service.configure({ template: newTemplate });
    setTimeout(() => valueInputRef.current?.focus(), 10);
  };

  const onChangeValue = (key: string, newValue: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) =>
        cur === key
          ? { ...acc, [cur]: newValue }
          : { ...acc, [cur]: template[cur] },
      {}
    );
    service.configure({ template: newTemplate });
    setTimeout(() => valueInputRef.current?.blur(), 10);
  };

  const onModeChange = (newMode: string) =>
    service.configure({ mode: newMode as Mode });

  const onRemoveProperty = (key: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) => (cur === key ? acc : { ...acc, [cur]: template[cur] }),
      {}
    );
    service.configure({ template: newTemplate });
  };

  const renderMapping = () => {
    return (
      <div
        style={{
          width: "100%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <RadioGroup
          id="MapMode"
          title="Mode"
          options={[Mode.REPLACE, Mode.OVERWRITE, Mode.ADD]}
          value={mode}
          onChange={onModeChange}
        />

        <div className="flex flex-col col-2 mt-4">
          <GroupLabel>Mapping</GroupLabel>
          <Table className="my-2">
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans tracking-widest text-base text-left p-0">
                  Property
                </TableHead>
                <TableHead className="font-sans tracking-widest text-base text-left p-0">
                  Value
                </TableHead>
                <TableHead className="font-sans tracking-widest text-base text-right p-0 w-min">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(template)
                .filter((key) => typeof template[key] !== "object")
                .map((key, idx) => (
                  <TableRow className="hover:bg-white" key={`${key}-${idx}`}>
                    <TableCell className="text-left p-0">
                      <SubmittableInput
                        value={key}
                        onSubmit={(newKey) => onChangeKey(key, newKey)}
                        onChangePending={setIsMappingChangePending}
                        selectAllOnFocus={true}
                      />
                    </TableCell>
                    <TableCell className="text-left p-0">
                      <SubmittableInput
                        ref={valueInputRef}
                        value={template[key]}
                        onSubmit={(newValue) => onChangeValue(key, newValue)}
                        onChangePending={setIsMappingChangePending}
                      />
                    </TableCell>
                    <TableCell className="text-right p-0">
                      <Button
                        variant="ghost"
                        onClick={() => onRemoveProperty(key)}
                        disabled={isMappingChangePending}
                      >
                        <X />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow className="pb-2">
                <TableCell colSpan={3}>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={onNewProperty}
                  >
                    <Plus size="20px" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 380, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
    >
      {renderMapping()}
    </ServiceUI>
  );
}
