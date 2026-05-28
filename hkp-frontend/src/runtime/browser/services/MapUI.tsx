import { useEffect, useMemo, useState } from "react";
import { Braces, SquarePlay, Table2 } from "lucide-react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import MappingTable, { Template } from "../../../components/MappingTable";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { globalScopeFunctions } from "hkp-frontend/src/runtime/browser/services/base/eval.ts";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

enum Mode {
  REPLACE = "replace",
  OVERWRITE = "overwrite",
  ADD = "add",
}

enum EditorMode {
  TABLE = "table",
  JSON = "json",
}

const ADD_ITEM_ACTION = "__add_item__";
const REMOVE_ITEM_ACTION = "__remove_item__";

function isObjectTemplate(template: any): template is Template {
  return !!template && typeof template === "object" && !Array.isArray(template);
}

export default function MapUI(props: ServiceUIProps) {
  const { service } = props;

  const [template, setTemplate] = useState<any>({});
  const [structuredTemplateText, setStructuredTemplateText] = useState("");
  const [structuredTemplateError, setStructuredTemplateError] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>(EditorMode.TABLE);
  const [selectedArrayIndex, setSelectedArrayIndex] = useState(0);
  const [mode, setMode] = useState<Mode>(Mode.REPLACE);
  const [isSensingMode, setIsSensingMode] = useState(false);

  const editableItems = useMemo(() => {
    if (isObjectTemplate(template)) {
      return [template as Template];
    }

    if (Array.isArray(template) && template.every(isObjectTemplate)) {
      return template as Template[];
    }

    return null;
  }, [template]);

  useEffect(() => {
    if (!editableItems) {
      setSelectedArrayIndex(0);
      return;
    }

    if (editableItems.length === 0) {
      setSelectedArrayIndex(0);
      return;
    }

    setSelectedArrayIndex((idx) => Math.min(idx, editableItems.length - 1));
  }, [editableItems]);

  const updateState = (newState: any) => {
    if (needsUpdate(newState.mode, mode)) {
      setMode(newState.mode);
    }

    if (needsUpdate(newState.template, template)) {
      setTemplate(newState.template);
      if (
        Array.isArray(newState.template) ||
        typeof newState.template === "object"
      ) {
        setStructuredTemplateText(JSON.stringify(newState.template, null, 2));
      }
      setStructuredTemplateError("");
    }

    if (needsUpdate(newState.sensingMode, isSensingMode)) {
      setIsSensingMode(newState.sensingMode);
    }
  };

  const onInit = (initialState: any) => updateState(initialState);

  const onNotification = (notification: any) => updateState(notification);

  const onModeChange = (newMode: string) => {
    setMode(newMode as Mode);
    service.configure({ mode: newMode as Mode });
  };

  const mappingOptions = [Mode.REPLACE, Mode.OVERWRITE, Mode.ADD];

  const onEditorModeChange = (nextMode: EditorMode) => {
    setEditorMode(nextMode);
  };

  const onToggleSensingMode = () => {
    service.configure({ sensingMode: !isSensingMode });
  };

  const onStructuredTemplateBlur = () => {
    try {
      const parsed = JSON.parse(structuredTemplateText);
      service.configure({ template: parsed });
      setStructuredTemplateError("");
    } catch (err: any) {
      setStructuredTemplateError(err?.message || "Invalid JSON");
    }
  };

  const persistItems = (items: Template[]) => {
    const sanitized = items.length > 0 ? items : [{}];
    const nextTemplate = sanitized.length === 1 ? sanitized[0] : sanitized;
    setTemplate(nextTemplate);
    setStructuredTemplateText(JSON.stringify(nextTemplate, null, 2));
    service.configure({ template: nextTemplate });
  };

  const onArrayItemTemplateChanged = (newTemplate: Template) => {
    if (!editableItems) {
      return;
    }

    const next = [...editableItems];
    next[selectedArrayIndex] = newTemplate;
    persistItems(next);
  };

  const addItem = () => {
    const next = [...(editableItems ?? [{}]), {}];
    setSelectedArrayIndex(next.length - 1);
    persistItems(next);
  };

  const removeCurrentItem = () => {
    if (!editableItems || editableItems.length === 0) {
      return;
    }

    if (editableItems.length === 1) {
      const next = [{}];
      setSelectedArrayIndex(0);
      persistItems(next);
      return;
    }

    const next = editableItems.filter(
      (_: any, idx: number) => idx !== selectedArrayIndex,
    );
    setSelectedArrayIndex((idx) => Math.max(0, Math.min(idx, next.length - 1)));
    persistItems(next);
  };

  const onItemSelectorChange = (value: string) => {
    if (value === ADD_ITEM_ACTION) {
      addItem();
      return;
    }

    if (value === REMOVE_ITEM_ACTION) {
      removeCurrentItem();
      return;
    }

    setSelectedArrayIndex(Number(value));
  };

  const itemSelectorOptions = useMemo(() => {
    if (!editableItems) {
      return {} as { [key: string]: string };
    }

    const options: { [key: string]: string } = {};
    editableItems.forEach((_: any, idx: number) => {
      options[String(idx)] = String(idx);
    });
    options[ADD_ITEM_ACTION] = "+ Add new item";
    options[REMOVE_ITEM_ACTION] = "- Remove current item";
    return options;
  }, [editableItems]);

  const customMenuEntries = [
    {
      name: editorMode === EditorMode.TABLE ? "Editor: JSON" : "Editor: Table",
      icon:
        editorMode === EditorMode.TABLE ? (
          <MenuIcon icon={Braces} />
        ) : (
          <MenuIcon icon={Table2} />
        ),
      onClick: () =>
        onEditorModeChange(
          editorMode === EditorMode.TABLE ? EditorMode.JSON : EditorMode.TABLE,
        ),
    },
    {
      name: "Inject Data",
      icon: <MenuIcon icon={SquarePlay} />,
      onClick: () => {
        service.configure({
          command: {
            action: "inject",
            params: {},
          },
        });
      },
    },
  ];

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 380, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
    >
      <div
        style={{
          width: "100%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PillRadioGroup
          title="Mode"
          options={mappingOptions}
          value={mode}
          onChange={onModeChange}
        />

        {editorMode === EditorMode.JSON ? (
          <div className="mb-2 flex flex-col gap-2">
            <div
              className="font-sans-clean text-[11px] font-semibold tracking-[0.06em] uppercase"
              style={{ color: "var(--text-dim)" }}
            >
              Mapping (Structured JSON)
            </div>
            <textarea
              className="w-full min-h-[180px] rounded-md border border-gray-300 bg-white p-2 font-mono text-xs"
              value={structuredTemplateText}
              onChange={(e) => setStructuredTemplateText(e.target.value)}
              onBlur={onStructuredTemplateBlur}
              spellCheck={false}
            />
            {structuredTemplateError && (
              <div className="text-xs text-red-600">
                {structuredTemplateError}
              </div>
            )}
          </div>
        ) : editableItems ? (
          <div className="mb-2 flex flex-col gap-2">
            {editableItems.length > 0 ? (
              <MappingTable
                className="mb-2"
                id={`${service.uuid}-array-${selectedArrayIndex}`}
                title="Mapping"
                titleTrailing={
                  <SelectorField
                    value={String(selectedArrayIndex)}
                    options={itemSelectorOptions}
                    className="items-center"
                    triggerClassName="h-[24px] min-h-[24px] px-3 py-0 rounded-md"
                    disabled={editableItems.length === 0}
                    onChange={({ value }) => onItemSelectorChange(value)}
                  />
                }
                tooltip="Edit one output mapping item"
                sensingMode={isSensingMode}
                onToggleSensingMode={onToggleSensingMode}
                template={editableItems[selectedArrayIndex] || {}}
                onTemplateChanged={onArrayItemTemplateChanged}
                autoCompleteValueSuggestions={{
                  params: "the incoming data",
                  ...globalScopeFunctions,
                }}
              />
            ) : (
              <div
                className="text-left py-1 text-[11.5px] italic font-sans-clean"
                style={{ color: "var(--text-dim)" }}
              >
                No mapping items yet.
              </div>
            )}
          </div>
        ) : (
          <div
            className="text-left py-1 text-[11.5px] italic font-sans-clean"
            style={{ color: "var(--text-dim)" }}
          >
            Current template cannot be rendered as mapping rows. Use JSON
            editor.
          </div>
        )}
      </div>
    </ServiceUI>
  );
}
