import { CSSProperties } from "react";
import { Power, PowerOff } from "lucide-react";

import Button from "hkp-frontend/src/ui-components/Button";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";

type Props = {
  bypass: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  onChange: (bypass: boolean) => void;
};

export default function BypassSwitch({ bypass, disabled, onChange }: Props) {
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  if (isPlayground) {
    // In playground: service is ON when bypass === false → show accent color
    const isOn = !bypass;
    const Icon = isOn ? Power : PowerOff;

    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isOn}
        onClick={() => !disabled && onChange(!bypass)}
        title={isOn ? "Disable service" : "Enable service"}
        className={[
          "w-[22px] h-[22px] rounded-[6px] border-none bg-transparent",
          "flex items-center justify-center flex-shrink-0",
          "transition-[background,color] [transition-duration:120ms]",
          disabled
            ? "cursor-default text-transparent"
            : [
                "cursor-pointer",
                isOn ? "text-[var(--hkp-accent)]" : "text-[var(--text-dim)]",
                "hover:bg-[oklch(0.95_0.02_15)] hover:text-[oklch(0.52_0.18_15)]",
              ].join(" "),
        ].join(" ")}
      >
        {!disabled && <Icon size={13} strokeWidth={1.7} />}
      </button>
    );
  }

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
