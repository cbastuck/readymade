import { CSSProperties } from "react";
import { Power, PowerOff } from "lucide-react";

import Button from "hkp-frontend/src/ui-components/Button";

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
      className="h-[50px] w-[50px] border-none hover:bg-sky"
      disabled={disabled}
      onClick={() => onChange(!bypass)}
    >
      {disabled ? null : (
        <Icon
          className={`mt-0 mb-1 mr-0 w-min h-min ${hoverIconColor} ${iconColor}`}
          name={disabled ? "power on" : "power off"}
        />
      )}
    </Button>
  );
}
