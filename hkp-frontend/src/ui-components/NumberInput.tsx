import { Input as InputCN } from "hkp-frontend/src/ui-components/primitives/input";
import PropertyLabel from "./GroupLabel";
import { ReactElement } from "react";

type Props = {
  title: string;
  value: number;
  disabled?: boolean;
  className?: string;
  children?: ReactElement | string;
  onChange: (newValue: number) => void;
};

export default function NumberInput({
  title,
  value,
  disabled,
  className,
  children,
  onChange,
}: Props) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <PropertyLabel className="hkp-svc-field-label" size={4}>
        {title}
      </PropertyLabel>
      <InputCN
        className="w-[60px] border-0 border-none p-0 h-min text-lg"
        type="number"
        value={value}
        onChange={(ev) => onChange(Number(ev.target.value))}
        disabled={disabled}
      />
      <div className="pl-2 tracking-[1px] text-xs">{children}</div>
    </div>
  );
}
