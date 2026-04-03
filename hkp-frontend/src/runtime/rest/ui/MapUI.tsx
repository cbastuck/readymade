import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import TemplateEditor from "hkp-frontend/src/ui-components/TemplateEditor";

export default function MapUI(props: ServiceUIProps) {
  const [template, setTemplate] = useState<object | null>(null);

  const onUpdate = (message: any) => {
    const { template } = message;
    if (template !== undefined) {
      setTemplate(template);
    }
  };

  const handleTemplateChange = (newTemplate: object) => {
    setTemplate(newTemplate);
    // Send the updated template back to the service
    props.service.configure({ template: newTemplate });
  };

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="py-2">
        <TemplateEditor
          template={template as any}
          onChange={handleTemplateChange}
        />
      </div>
    </RuntimeRestServiceUI>
  );
}
