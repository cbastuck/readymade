import Text from "@/ui-components/Text";
import { s, t } from "../../styles";

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
        <Text key={`usecase-${name}-description-${idx}`} yMargin={0}>
          {typeof content === "string" ? content : ""}
        </Text>
      ))}
    </div>
  );
}
