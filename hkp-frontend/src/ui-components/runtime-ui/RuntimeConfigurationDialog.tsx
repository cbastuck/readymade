import {
  RuntimeConfiguration,
  RuntimeDescriptor,
} from "hkp-frontend/src/types";
import EditorDialog from "../EditorDialog";
import InputField from "hkp-frontend/src/components/shared/InputField";
import { ColorPicker } from "../ColorPicker";
import GroupLabel from "../GroupLabel";

type Props = {
  isOpen: boolean;
  config: RuntimeConfiguration;
  onClose: () => void;
  onApply: (value: string | object, closeDialog: boolean) => void;
};

export default function RuntimeConfigurationDialog({
  isOpen,
  config,
  onClose,
  onApply,
}: Props) {
  const runtimeConfig = JSON.stringify(config, null, 2);
  const color = config.runtime.state?.color || "white";
  const onChangeColor = (color: string) => {
    onApply(
      {
        ...config,
        runtime: {
          ...config.runtime,
          state: {
            ...config.runtime.state,
            color,
          },
        },
      },
      false,
    );
  };

  const onChange = (update: Partial<RuntimeDescriptor>) => {
    onApply({ ...config, runtime: { ...config.runtime, ...update } }, true);
  };

  const actions = [
    {
      label: "Apply Changes",
      onAction: (action: string | object) => onApply(action, true),
    },
  ];

  return (
    <EditorDialog
      title="Runtime Configuration"
      description="Edit runtime metadata, color, and JSON configuration."
      value={runtimeConfig}
      isOpen={isOpen}
      onClose={onClose}
      actions={actions}
    >
      <div className="flex">
        <InputField
          label="Id"
          value={config.runtime.id}
          onChange={(id) => onChange({ id })}
          disabled={true}
        />
        <InputField
          label="Name"
          value={config.runtime.name}
          onChange={(name) => onChange({ name })}
        />
      </div>
      <div className="flex">
        <InputField
          label="Type"
          value={config.runtime.type}
          onChange={(url) => onChange({ url })}
          disabled={true}
        />

        <InputField
          label="Url"
          value={config.runtime.url}
          disabled={!config.runtime.url}
        />
      </div>
      <div className="flex gap-1 items-begin mt-1 w-[120px]">
        <GroupLabel size={4}>Color</GroupLabel>
        <ColorPicker
          className="h-6 w-full"
          showPaletteOnly={true}
          value={color}
          onChange={onChangeColor}
        />
      </div>
    </EditorDialog>
  );
}
