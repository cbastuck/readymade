import { s, t } from "../../styles";
import CardText from "hkp-frontend/src/ui-components/CardText";

type Props = {
  name: string;
  description: string;
};

export default function Description({ name, description }: Props) {
  if (!description) {
    return "";
  }

  const d = Array.isArray(description) ? description : [description];
  return (
    <div style={s(t.nc)}>
      {d.map((content, idx) => (
        <CardText key={`usecase-${name}-description-${idx}`}>
          {typeof content === "string" ? content : ""}
        </CardText>
      ))}
    </div>
  );
}
