import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { Switch } from "hkp-frontend/src/ui-components/primitives/switch";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import Select from "hkp-frontend/src/ui-components/Select";
import DeleteButton from "./DeleteButton";

type TemplateValue = string | number | boolean | TemplateObject;

export type TemplateObject = {
  [key: string]: TemplateValue;
};

type PathItem = {
  key: string;
  object: TemplateObject;
};

type ValueType = "string" | "number" | "boolean" | "object";

type Props = {
  template: TemplateObject | null;
  onChange: (newTemplate: TemplateObject) => void;
  className?: string;
};

export default function TemplateEditor({
  template,
  onChange,
  className = "",
}: Props) {
  const [navigationPath, setNavigationPath] = useState<PathItem[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<ValueType>("string");

  // Get current level object based on navigation path
  const getCurrentObject = (): TemplateObject => {
    if (navigationPath.length === 0) {
      return template || {};
    }
    return navigationPath[navigationPath.length - 1].object;
  };

  // Navigate into a nested object
  const navigateInto = (key: string) => {
    const currentObj = getCurrentObject();
    const value = currentObj[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      setNavigationPath([
        ...navigationPath,
        { key, object: value as TemplateObject },
      ]);
    }
  };

  // Navigate to specific level in breadcrumb
  const navigateToLevel = (index: number) => {
    if (index === -1) {
      setNavigationPath([]);
    } else {
      setNavigationPath(navigationPath.slice(0, index + 1));
    }
  };

  // Update a value in the template
  const updateValue = (key: string, newValue: TemplateValue) => {
    const newTemplate = JSON.parse(JSON.stringify(template || {})); // Deep clone, handle null

    // Navigate to the current level in the new template
    let target: TemplateObject = newTemplate;
    for (const pathItem of navigationPath) {
      target = target[pathItem.key] as TemplateObject;
    }

    console.log("Updating key:", key, "to value:", newValue, target);
    target[key] = newValue;
    onChange(newTemplate);
  };

  // Delete a property
  const deleteProperty = (key: string) => {
    const newTemplate = JSON.parse(JSON.stringify(template));
    let target: TemplateObject = newTemplate;
    for (const pathItem of navigationPath) {
      target = target[pathItem.key] as TemplateObject;
    }
    delete target[key];
    onChange(newTemplate);
  };

  // Change type of a property
  const changePropertyType = (key: string, newType: ValueType) => {
    const defaultValues: Record<ValueType, TemplateValue> = {
      string: "",
      number: 0,
      boolean: false,
      object: {},
    };
    updateValue(key, defaultValues[newType]);
  };

  // Add a new property
  const addProperty = () => {
    if (!newPropertyName.trim()) return;

    const defaultValues: Record<ValueType, TemplateValue> = {
      string: "",
      number: 0,
      boolean: false,
      object: {},
    };

    updateValue(newPropertyName, defaultValues[newPropertyType]);
    setNewPropertyName("");
    setNewPropertyType("string");
    setAddingNew(false);
  };

  // Get the type of a value
  const getValueType = (value: TemplateValue): ValueType => {
    if (typeof value === "object" && value !== null) {
      return "object";
    }
    return typeof value as ValueType;
  };

  const groupLabelWidth = "[100px]";

  // Render input based on value type
  const renderValueInput = (key: string, value: TemplateValue) => {
    const valueType = getValueType(value);

    return (
      <div className="flex items-center gap-2 py-2 w-full">
        <GroupLabel className={`w-${groupLabelWidth} flex-shrink-0`} size={4}>
          {key}
        </GroupLabel>

        <Select
          options={["string", "number", "boolean", "object"]}
          value={valueType}
          onChange={(type) => changePropertyType(key, type as ValueType)}
          className="w-20 text-xs"
        />

        {valueType === "boolean" && (
          <div className="w-32 h-8 flex items-center justify-center">
            <Switch
              checked={value as boolean}
              onCheckedChange={(checked) => updateValue(key, checked)}
            />
          </div>
        )}

        {valueType === "number" && (
          <Input
            type="number"
            value={value as number}
            onChange={(e) => updateValue(key, Number(e.target.value))}
            className="w-32 h-8"
          />
        )}

        {valueType === "string" && (
          <Input
            type="text"
            defaultValue={value as string}
            onBlur={(e) => updateValue(key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateValue(key, e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            className="w-32 h-8"
            spellCheck={false}
          />
        )}

        {valueType === "object" && (
          <Button
            variant="outline"
            onClick={() => navigateInto(key)}
            className="h-8 w-32"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <DeleteButton
          title={`Delete property "${key}"`}
          onClick={() => deleteProperty(key)}
        />
      </div>
    );
  };

  const currentObject = getCurrentObject();
  const entries = Object.entries(currentObject);

  return (
    <div className={`flex flex-col w-full h-full ${className}`}>
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center">
        <div className="flex items-center flex-wrap min-w-0">
          <button
            onClick={() => navigateToLevel(-1)}
            className={`text-sm tracking-wider px-1 py-1 rounded hover:bg-gray-100 flex-shrink-0 ${
              navigationPath.length === 0 ? "font-bold" : "text-gray-600"
            }`}
          >
            root
          </button>

          {navigationPath.map((pathItem, index) => (
            <div key={index} className="flex items-center">
              <span className="text-gray-400">/</span>
              <button
                onClick={() => navigateToLevel(index)}
                className={`text-sm tracking-wider px-1 py-1 rounded hover:bg-gray-100 ${
                  index === navigationPath.length - 1
                    ? "font-bold"
                    : "text-gray-600"
                }`}
              >
                {pathItem.key}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Property Editor */}
      <div className="flex flex-col w-[90%] mx-auto min-h-0">
        {entries.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center">
            No properties at this level
          </div>
        ) : (
          entries.map(([key, value]) => (
            <div key={key}>{renderValueInput(key, value)}</div>
          ))
        )}

        {/* Add New Property */}
        {addingNew ? (
          <div className="flex items-center gap-2 py-2 w-full border-t border-gray-300 mt-2 pt-2">
            <Input
              type="text"
              placeholder="Property name"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              className="w-[100px] h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") addProperty();
                if (e.key === "Escape") {
                  setAddingNew(false);
                  setNewPropertyName("");
                }
              }}
              autoFocus
              spellCheck={false}
            />
            <Select
              options={["string", "number", "boolean", "object"]}
              value={newPropertyType}
              onChange={(type) => setNewPropertyType(type as ValueType)}
              className="w-20 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addProperty}
              className="h-8"
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddingNew(false);
                setNewPropertyName("");
              }}
              className="h-8"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setAddingNew(true)}
            className="mt-2 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        )}
      </div>
    </div>
  );
}
