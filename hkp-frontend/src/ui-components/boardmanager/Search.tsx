import { Input } from "hkp-frontend/src/ui-components/primitives/input";

type Props = {
  filter: string;
  onChange: (filter: string) => void;
};

export default function Search({ filter, onChange }: Props) {
  return (
    <div className="mb-1 w-[180px]">
      <Input
        className="text-base"
        placeholder="Search"
        value={filter}
        onChange={(ev) => onChange(ev.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
