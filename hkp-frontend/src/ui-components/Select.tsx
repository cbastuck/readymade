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
  /**
   * A trigger sized to sit in a line of small print rather than to be the
   * thing on the row.
   *
   * A prop rather than a class the caller passes, because the size is set here
   * and two font-size utilities on one element are settled by the order
   * Tailwind emits them in, not by the order they are written.
   */
  compact?: boolean;
  onChange: (newValue: string) => void;
};

export default function Select({
  title,
  options,
  value,
  disabled,
  className,
  compact,
  onChange,
}: Props) {
  return (
    <SelectCN value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`w-min border-none border-0 ${
          compact ? "text-xs" : "text-lg"
        } p-0 h-min ${className || ""}`}
      >
        <SelectValue placeholder={value || title} />
      </SelectTrigger>
      <SelectContent className={className}>
        <SelectGroup>
          {title && <SelectLabel>{title}</SelectLabel>}
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
