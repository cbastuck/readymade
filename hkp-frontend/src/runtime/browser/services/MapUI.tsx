import { useState } from "react";

import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import RadioGroup from "@/ui-components/RadioGroup";

import { createExpandableTooltip } from "@/ui-components/ExpandableTooltip";

import MapUIModeAssist from "./MapUIModeAssist";
import MappingTable, { Template } from "../../../components/MappingTable";

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

  const onModeChange = (newMode: string) =>
    service.configure({ mode: newMode as Mode });

  const mappingOptions = [Mode.REPLACE, Mode.OVERWRITE, Mode.ADD];

  const onToggleSensingMode = () => {
    service.configure({ sensingMode: !isSensingMode });
  };

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 380, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
    >
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
          tooltip={createExpandableTooltip(
            "Select the mode of mapping",
            <MapUIModeAssist />
          )}
          options={mappingOptions}
          value={mode}
          onChange={onModeChange}
          valueTooltips={mappingOptions.map(mapModeToTooltip)}
        />

        <MappingTable
          id={service.uuid}
          title="Mapping"
          tooltip="Map the incoming data to something else"
          sensingMode={isSensingMode}
          onToggleSensingMode={onToggleSensingMode}
          template={template}
          onTemplateChanged={(newTemplate: Template) =>
            service.configure({ template: newTemplate })
          }
        />
      </div>
    </ServiceUI>
  );
}

function mapModeToTooltip(mode: Mode) {
  switch (mode) {
    case Mode.REPLACE:
      return "Replace the whole incoming data with the mapped properties";
    case Mode.OVERWRITE:
      return "Overwrite the mapped properties to the incoming data";
    case Mode.ADD:
      return "Add the mapped properties to the incoming data";
  }
}
