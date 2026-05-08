import { useMemo, useRef, useState } from "react";
import {
  Trash,
  Plus,
  CircleDotDashed,
  CircleDot,
  Ellipsis,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";

import Button from "hkp-frontend/src/ui-components/Button";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import { delayedExec } from "hkp-frontend/src/common";
import AutocompleteInputField from "./shared/AutocompleteInputField";
import SubmittableInputWithToggle from "hkp-frontend/src/ui-components/SubmittableInputWithToggle";
import { checkSyntax } from "hkp-frontend/src/runtime/browser/services/base/eval";

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
    (key) => typeof template[key] !== "object",
  );

  const rowIsDynamic = rows.map((key) => key.endsWith("="));
  const rowIsSyntaxCheck = useMemo(
    () =>
      rows.map((key, idx) => !rowIsDynamic[idx] || checkSyntax(template[key])),
    [template, rowIsDynamic, rows],
  );

  const onNewProperty = () => {
    const newKey = "key";
    const allKeys = Object.keys(template);
    if (!allKeys.includes(newKey)) {
      onTemplateChanged({
        ...template,
        [newKey]: "value",
      });
      return;
    }
    const keys = allKeys
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
      {},
    );
    onTemplateChanged(newTemplate);
  };

  const onChangeValue = (key: string, newValue: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) =>
        cur === key
          ? { ...acc, [cur]: newValue }
          : { ...acc, [cur]: template[cur] },
      {},
    );
    onTemplateChanged(newTemplate);
    setTimeout(() => valueInputRef.current?.blur(), 10);
  };

  const onRemoveProperty = (key: string) => {
    const newTemplate = Object.keys(template).reduce(
      (acc, cur) => (cur === key ? acc : { ...acc, [cur]: template[cur] }),
      {},
    );
    onTemplateChanged(newTemplate);
  };

  const onKeyChange = (oldKey: string, newKey: string, propIdx: number) => {
    updateKey(oldKey, newKey);
    const valueInputElementId = `map-value-${id}-${propIdx}`;
    delayedExec(
      () => document.getElementById(valueInputElementId)?.focus(),
      10,
    );
  };

  const onToggleKeyDynamics = (key: string, propIdx: number) => {
    if (key.endsWith("=")) {
      onKeyChange(key, key.slice(0, -1), propIdx);
    } else {
      onKeyChange(key, key + "=", propIdx);
    }
  };

  const onRemoveMapping = () => onTemplateChanged({});

  return (
    <div className={`flex flex-col col-2 mt-2 gap-2 ${className}`}>
      <div className="flex h-min items-end">
        <GroupLabel size={3} tooltip={tooltip}>
          {title}
        </GroupLabel>

        <div className="flex ml-auto">
          <Button
            className="stroke-gray-600 hover:stroke-white hover:bg-red-500 w-win h-[24px] mr-2 rounded-lg"
            variant="ghost"
            onClick={onRemoveMapping}
            disabled={isMappingChangePending}
            tooltip="Remove whole Mapping"
            tabIndex={-1}
            aria-label="Remove whole mapping"
          >
            <Trash className="stroke-inherit" size={16} />
          </Button>
          {onToggleSensingMode && (
            <Button
              className={`h-[24px] hover:bg-red-500 hover:stroke-white rounded-lg ${
                sensingMode ? "bg-red-500 stroke-white" : ""
              }`}
              variant="ghost"
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
            variant="ghost"
            onClick={onNewProperty}
            disabled={sensingMode}
            tooltip="Add a property"
            aria-label="Add property"
          >
            <Plus size="20px" />
          </Button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mx-2 max-h-[250px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="font-sans-clean text-[11px] font-semibold tracking-[0.06em] uppercase text-left p-0 h-min"
                  style={{ color: "var(--text-dim)" }}
                >
                  Property
                </TableHead>
                <TableHead
                  className="font-sans-clean text-[11px] font-semibold tracking-[0.06em] uppercase text-left p-0 h-min"
                  style={{ color: "var(--text-dim)" }}
                >
                  Value
                </TableHead>
                <TableHead className="text-center p-0 w-min h-min">
                  <Ellipsis size={14} style={{ color: "var(--text-dim)" }} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key, idx) => (
                <TableRow
                  className="hover:bg-transparent font-sans-clean"
                  key={`${key}-${idx}`}
                >
                  <TableCell className="text-left p-0 w-[50%]">
                    <SubmittableInputWithToggle
                      fullWidth
                      hideBottomBorder
                      value={key}
                      onSubmit={(newKey) => onKeyChange(key, newKey, idx)}
                      onChangePending={setIsMappingChangePending}
                      selectAllOnFocus={false}
                      onTab={(newKey) => onKeyChange(key, newKey, idx)}
                      onToggle={() => onToggleKeyDynamics(key, idx)}
                      toggleValue={rowIsDynamic[idx]}
                      toggleTooltip={
                        rowIsDynamic[idx]
                          ? "Deactivate Javascript and switch to static mapping"
                          : "Activate to enable Javascript in the value field"
                      }
                      aria-label={`Map key ${idx}`}
                    />
                  </TableCell>
                  <TableCell className="text-left p-0 w-[50%]">
                    <AutocompleteInputField
                      id={`map-value-${id}-${idx}`}
                      ref={valueInputRef}
                      value={template[key]}
                      onSubmit={(newValue) => onChangeValue(key, newValue)}
                      onTab={(newValue) => onChangeValue(key, newValue)}
                      onChangePending={setIsMappingChangePending}
                      selectAllOnFocus={false}
                      autoCompleteValueSuggestions={
                        rowIsDynamic[idx] && autoCompleteValueSuggestions
                      }
                      showBackground={!!rowIsDynamic[idx]}
                      className={
                        rowIsDynamic[idx]
                          ? rowIsSyntaxCheck[idx] === true
                            ? ""
                            : "bg-red-200 text-gray-800"
                          : undefined
                      }
                      tooltip={
                        rowIsSyntaxCheck[idx] === true
                          ? undefined
                          : (rowIsSyntaxCheck[idx] as string)
                      }
                      isExpandable
                    />
                  </TableCell>
                  <TableCell className="text-right p-0">
                    <Button
                      className="stroke-gray-600 hover:stroke-red-500 w-win px-1"
                      variant="ghost"
                      onClick={() => onRemoveProperty(key)}
                      disabled={isMappingChangePending}
                      tooltip="Remove this row"
                      tabIndex={-1}
                      aria-label="Remove row"
                    >
                      <Trash className="stroke-inherit" size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div
          className="text-left py-1 text-[11.5px] italic font-sans-clean"
          style={{ color: "var(--text-dim)" }}
        >
          No mapping available
        </div>
      )}
    </div>
  );
}
