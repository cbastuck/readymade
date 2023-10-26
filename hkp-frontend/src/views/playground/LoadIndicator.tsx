import { Loader } from "semantic-ui-react";
import { s, t } from "../../styles";

export default function LoadIndicator() {
  return (
    <div
      style={s(t.uc, t.ls1, {
        position: "absolute",
        left: "45%",
        top: "45%",
      })}
    >
      <Loader active inline>
        Loading Playground
      </Loader>
    </div>
  );
}
