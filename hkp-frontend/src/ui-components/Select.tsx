import {
  Select as SelectCN,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  title?: string;
  options: Array<string>;
  value?: string;
  onChange: (newValue: string) => void;
};

export default function Select({ title, options, value, onChange }: Props) {
  return (
    <SelectCN value={value} onValueChange={onChange}>
      <SelectTrigger className="w-min border-none border-0 text-lg p-0 h-min">
        <SelectValue placeholder={value || title} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{title}</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectCN>
  );
}
