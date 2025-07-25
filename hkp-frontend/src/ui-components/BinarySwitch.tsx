import { Switch } from "hkp-frontend/src/ui-components/primitives/switch";

type Props = {
  label: string;
  value: boolean;
  className?: string;
  disabled?: boolean;
  onChange: (newValue: boolean) => void;
};

export default function BinarySwitch({
  label,
  value,
  className,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="flex items-end my-4">
      <div
        className={`text-base ${
          disabled && "text-gray-400"
        } p-0 tracking-widest ${className}`}
      >
        {label}
      </div>
      <Switch
        className="ml-4 mr-auto"
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
