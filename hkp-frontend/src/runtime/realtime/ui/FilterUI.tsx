import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RealtimeRuntimeServiceUI from "../RealtimeRuntimeServiceUI";
import TemplateEditor, {
  TemplateObject,
} from "hkp-frontend/src/ui-components/TemplateEditor";
import Switch from "hkp-frontend/src/ui-components/Switch";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

export default function FilterUI(props: ServiceUIProps) {
  const [template, setTemplate] = useState<TemplateObject | null>(null);
  const [open, setOpen] = useState<boolean>(true);
  const [mode, setMode] = useState<string>("AND");

  const onUpdate = useCallback((message: any) => {
    const { template, open, mode } = message;
    if (template !== undefined) {
      setTemplate(template);
    }

    if (open !== undefined) {
      setOpen(open);
    }

    if (mode !== undefined) {
      setMode(mode);
    }
  }, []);

  const handleTemplateChange = (newTemplate: TemplateObject) => {
    setTemplate(newTemplate);
    // Send the updated template back to the service
    props.service.configure({ template: newTemplate });
  };

  const onToggleOpen = (checked: boolean) => {
    setOpen(checked);
    props.service.configure({ open: checked });
  };

  const modeOptions = {
    AND: "AND",
    OR: "OR",
  };

  return (
    <RealtimeRuntimeServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex gap-4 items-center">
        <Switch
          className="py-2"
          labelClassName="tracking-[1px] text-base2"
          title="open"
          checked={open}
          onCheckedChange={onToggleOpen}
        />
        <SelectorField
          disabled={!open}
          value={mode}
          label="Mode"
          options={modeOptions}
          onChange={({ value }) => {
            props.service.configure({ mode: value });
          }}
          labelStyle={{
            textTransform: "capitalize",
            textAlign: "left",
          }}
          uppercaseKeys={false}
          uppercaseValues={false}
        />
      </div>
      <div className="border border-gray-300 p-2 my-2">
        <h3 className="tracking-[6px]">Template</h3>
        <TemplateEditor template={template} onChange={handleTemplateChange} />
      </div>
    </RealtimeRuntimeServiceUI>
  );
}
