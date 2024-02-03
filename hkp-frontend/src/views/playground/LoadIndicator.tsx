import { Loader } from "semantic-ui-react";
import { s, t } from "../../styles";

type Props = {
  text: string;
};
export default function LoadIndicator({ text }: Props) {
  return (
    <div
      style={s(t.uc, t.ls1, {
        position: "absolute",
        left: "45%",
        top: "45%",
      })}
    >
      <Loader active inline>
        {text}
      </Loader>
    </div>
  );
}
