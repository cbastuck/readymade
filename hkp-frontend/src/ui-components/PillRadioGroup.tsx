import GroupLabel from "./GroupLabel";

type Props = {
  title?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

export default function PillRadioGroup({
  title,
  options,
  value,
  onChange,
}: Props) {
  return (
    <div>
      {title && (
        <GroupLabel className="pb-1" size={4}>
          {title}
        </GroupLabel>
      )}
      <div style={{ display: "flex", gap: 5 }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`hkp-rpill${opt === value ? " sel" : ""} capitalize`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
