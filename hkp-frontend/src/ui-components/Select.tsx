import {
  Select as SelectCN,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "hkp-frontend/src/ui-components/primitives/select";

type Props = {
  title?: string;
  options: Array<string>;
  value?: string;
  disabled?: boolean;
  className?: string;
  onChange: (newValue: string) => void;
};

export default function Select({
  title,
  options,
  value,
  disabled,
  className,
  onChange,
}: Props) {
  return (
    <SelectCN value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`w-min border-none border-0 text-lg p-0 h-min ${
          className || ""
        }`}
      >
        <SelectValue placeholder={value || title} />
      </SelectTrigger>
      <SelectContent className={className}>
        <SelectGroup>
          <SelectLabel>{title}</SelectLabel>
          {options.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="focus:bg-[var(--hkp-accent-dim)] focus:text-[var(--hkp-accent)]"
            >
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectCN>
  );
}
