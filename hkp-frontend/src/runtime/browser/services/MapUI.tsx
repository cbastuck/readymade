import { useState } from "react";
import { SquarePlay } from "lucide-react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import MappingTable, { Template } from "../../../components/MappingTable";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { globalScopeFunctions } from "hkp-frontend/src/runtime/browser/services/base/eval.ts";

enum Mode {
  REPLACE = "replace",
  OVERWRITE = "overwrite",
  ADD = "add",
}

export default function MapUI(props: ServiceUIProps) {
  const { service } = props;

  const [template, setTemplate] = useState<any>({});
  const [mode, setMode] = useState<Mode>(Mode.REPLACE);
  const [isSensingMode, setIsSensingMode] = useState(false);

  const updateState = (newState: any) => {
    if (needsUpdate(newState.mode, mode)) {
      setMode(newState.mode);
    }

    if (needsUpdate(newState.template, template)) {
      setTemplate(newState.template);
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

  const onToggleSensingMode = () => {
    service.configure({ sensingMode: !isSensingMode });
  };

  const customMenuEntries = [
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

        <MappingTable
          className="mb-2"
          id={service.uuid}
          title="Mapping"
          tooltip="Map the incoming data to something else"
          sensingMode={isSensingMode}
          onToggleSensingMode={onToggleSensingMode}
          template={template}
          onTemplateChanged={(newTemplate: Template) =>
            service.configure({ template: newTemplate })
          }
          autoCompleteValueSuggestions={{
            params: "the incoming data",
            ...globalScopeFunctions,
          }}
        />
      </div>
    </ServiceUI>
  );
}
