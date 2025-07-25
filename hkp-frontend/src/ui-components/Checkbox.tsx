import { Checkbox as CheckboxCN } from "hkp-frontend/src/ui-components/primitives/checkbox";

type Props = {
  id?: string;
  title?: string;
  checked: boolean;
  onChange: (newChecked: boolean) => void;
};

export default function Checkbox({ id, title, checked, onChange }: Props) {
  return (
    <div className="flex items-end space-x-2 text-base">
      <CheckboxCN
        id={id || title}
        checked={checked}
        onCheckedChange={onChange}
      />
      <label
        htmlFor={id || title}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {title || null}
      </label>
    </div>
  );
}
