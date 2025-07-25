import { s, t } from "hkp-frontend/src/styles";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

type Props = {
  runtime: RuntimeDescriptor;
};

export default function EmptyRuntimePlaceholder({ runtime }: Props) {
  return (
    <div
      style={{
        width: "100%",
        margin: "auto",
        textAlign: "center",
        minHeight: 220,
      }}
    >
      <div style={s(t.fs13, t.ls1, { marginTop: 90 })}>
        This is an empty runtime.
        <span
          style={{ cursor: "help", color: "#4284C4" }}
          onClick={() => {
            document.getElementById(`service-selector-${runtime.id}`)?.click();
          }}
        >
          {" Add a service "}
        </span>
        to get going
      </div>
    </div>
  );
}
