import { s, t } from "../../styles";

type Props = {
  name: string;
  description: string;
};

export default function ({ name, description }: Props) {
  if (!description) {
    return "No description available";
  }

  const d = Array.isArray(description) ? description : [description];
  return (
    <div style={s(t.nc)}>
      {d.map((content, idx) => (
        <div key={`usecase-${name}-description-${idx}`} style={t.mt5}>
          {typeof content === "string" ? content : ""}
        </div>
      ))}
    </div>
  );
}
