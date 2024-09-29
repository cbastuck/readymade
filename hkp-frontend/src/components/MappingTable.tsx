import { useMemo, useRef, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";
import { Trash, Plus, CircleDotDashed, CircleDot } from "lucide-react";

import Button from "@/ui-components/Button";
import GroupLabel from "@/ui-components/GroupLabel";
import { delayedExec } from "@/common";
import AutoInputField from "./shared/AutoInputField";
import SubmittableInputWithToggle from "@/ui-components/SubmittableInputWithToggle";
import { checkSyntax } from "@/runtime/browser/services/base/eval";

export type Template = { [key: string]: string };

type Props = {
  id: string;
  className?: string;
  title: string;
  template: { [key: string]: string };
  tooltip?: string;
  sensingMode?: boolean;
  autoCompleteValueSuggestions?: any;
  onToggleSensingMode?: () => void;
  onTemplateChanged: (template: Template) => void;
};

export default function MappingTable({
  id,
  className,
  title,
  template,
  sensingMode,
  tooltip,
  autoCompleteValueSuggestions,
  onToggleSensingMode,
  onTemplateChanged,
}: Props) {
  const [isMappingChangePending, setIsMappingChangePending] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const rows = Object.keys(template).filter(
    (key) => typeof template[key] !== "object"
  );

  const rowIsDynamic = rows.map((key) => key.endsWith("="));
  const rowIsSyntaxCheck = useMemo(
    () =>
      rows.map((key, idx) => !rowIsDynamic[idx] || checkSyntax(template[key])),
    [template]
  );

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
    onTemplateChanged({
      ...template,
      [incKey]: "value",
    });
  };

  const updateKey = (key: string, newKey: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) =>
        cur === key
          ? { ...acc, [newKey]: template[cur] }
          : { ...acc, [cur]: template[cur] },
      {}
    );
    onTemplateChanged(newTemplate);
  };

  const onChangeValue = (key: string, newValue: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) =>
        cur === key
          ? { ...acc, [cur]: newValue }
          : { ...acc, [cur]: template[cur] },
      {}
    );
    onTemplateChanged(newTemplate);
    setTimeout(() => valueInputRef.current?.blur(), 10);
  };

  const onRemoveProperty = (key: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) => (cur === key ? acc : { ...acc, [cur]: template[cur] }),
      {}
    );
    onTemplateChanged(newTemplate);
  };

  const onKeyChange = (oldKey: string, newKey: string, propIdx: number) => {
    updateKey(oldKey, newKey);
    const valueInputElementId = `map-value-${id}-${propIdx}`;
    delayedExec(
      () => document.getElementById(valueInputElementId)?.focus(),
      10
    );
  };

  const onToggleKeyDynamics = (key: string, propIdx: number) => {
    if (key.endsWith("=")) {
      onKeyChange(key, key.slice(0, -1), propIdx);
    } else {
      onKeyChange(key, key + "=", propIdx);
    }
  };

  return (
    <div className={`flex flex-col col-2 mt-2 gap-2 ${className}`}>
      <div className="flex h-min items-end">
        <GroupLabel tooltip={tooltip}>{title}</GroupLabel>
        <div className="flex ml-auto">
          {onToggleSensingMode && (
            <Button
              className={`h-[24px] hover:bg-red-500 hover:stroke-white ${
                sensingMode ? "bg-red-500 stroke-white" : ""
              }`}
              variant="outline"
              onClick={onToggleSensingMode}
              tooltip={
                sensingMode
                  ? "Stop listening to incoming data"
                  : "Derive a mapping from incoming data"
              }
            >
              {sensingMode ? (
                <CircleDot height="16px" className="stroke-white" />
              ) : (
                <CircleDotDashed height="16px" />
              )}
            </Button>
          )}
          <Button
            className="h-[24px]"
            variant="outline"
            onClick={onNewProperty}
            disabled={sensingMode}
            tooltip="Add a property"
          >
            <Plus size="20px" />
          </Button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mx-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans tracking-widest text-base text-left p-0 h-min">
                  Property
                </TableHead>
                <TableHead className="font-sans tracking-widest text-base text-left p-0 h-min">
                  Value
                </TableHead>
                <TableHead className="font-sans tracking-widest text-base text-center p-0 w-min h-min">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key, idx) => (
                <TableRow
                  className="hover:bg-white font-sans-clean"
                  key={`${key}-${idx}`}
                >
                  <TableCell className="text-left p-0 w-[50%]">
                    <SubmittableInputWithToggle
                      fullWidth
                      hideBottomBorder
                      value={key}
                      onSubmit={(newKey) => onKeyChange(key, newKey, idx)}
                      onChangePending={setIsMappingChangePending}
                      selectAllOnFocus={true}
                      onTab={(newKey) => onKeyChange(key, newKey, idx)}
                      onToggle={() => onToggleKeyDynamics(key, idx)}
                      toggleValue={rowIsDynamic[idx]}
                      toggleTooltip={
                        rowIsDynamic[idx]
                          ? "Deactivate Javascript and switch to static mapping"
                          : "Activate to enable Javascript in the value field"
                      }
                    />
                  </TableCell>
                  <TableCell className="text-left p-0 w-[50%]">
                    <AutoInputField
                      id={`map-value-${id}-${idx}`}
                      ref={valueInputRef}
                      value={template[key]}
                      onSubmit={(newValue) => onChangeValue(key, newValue)}
                      onTab={(newValue) => onChangeValue(key, newValue)}
                      onChangePending={setIsMappingChangePending}
                      selectAllOnFocus={true}
                      autoCompleteValueSuggestions={
                        rowIsDynamic[idx] && autoCompleteValueSuggestions
                      }
                      className={
                        rowIsDynamic[idx]
                          ? `rounded-xl p-1 px-2 ${
                              rowIsSyntaxCheck[idx] === true
                                ? "bg-gray-100"
                                : "bg-red-200 text-gray-800"
                            }`
                          : undefined
                      }
                      tooltip={
                        rowIsSyntaxCheck[idx] === true
                          ? undefined
                          : (rowIsSyntaxCheck[idx] as string)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right p-0">
                    <Button
                      variant="ghost"
                      onClick={() => onRemoveProperty(key)}
                      disabled={isMappingChangePending}
                      tooltip="Remove this row"
                      className="stroke-gray-600 hover:stroke-red-500"
                      tabIndex={-1}
                    >
                      <Trash className="stroke-inherit" size="16px" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-left py-2 text-gray-300">No mapping available</div>
      )}
    </div>
  );
}
