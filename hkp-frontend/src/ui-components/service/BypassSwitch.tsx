import { CSSProperties } from "react";
import { Power, PowerOff } from "lucide-react";
import Button from "@/ui-components/Button";

type Props = {
  bypass: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  onChange: (bypass: boolean) => void;
};

export default function BypassSwitch({ bypass, disabled, onChange }: Props) {
  const iconColor = bypass ? "stroke-red-300" : "stroke-gray-400";
  const hoverIconColor = bypass
    ? "hover:stroke-red-300"
    : "hover:stroke-sky-400";
  const Icon = bypass ? PowerOff : Power;
  return (
    <Button
      className="border-none hover:bg-sky"
      disabled={disabled}
      onClick={() => onChange(!bypass)}
    >
      {disabled ? (
        <div style={{ width: 16 }} />
      ) : (
        <Icon
          size="18px"
          className={`mt-2 w-min h-min ${hoverIconColor} ${iconColor}`}
          name="power off"
        />
      )}
    </Button>
  );
}
