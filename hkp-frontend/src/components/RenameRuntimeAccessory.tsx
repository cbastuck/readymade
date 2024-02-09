import { useState } from "react";
import { Icon, Input } from "semantic-ui-react";

import { s, t } from "../styles";

type Props = {
  name: string;
  runtimeId: string;
  onChangeName: (newName: string) => void;
};

export default function RenameRuntimeAccessory({
  name,
  runtimeId,
  onChangeName,
}: Props) {
  const [runtimeNameEditBuffer, setRuntimeNameEditBuffer] = useState("");
  const topMargin = { marginTop: 6 };
  return runtimeNameEditBuffer ? (
    <div style={{ display: "flex", flexDirection: "row", marginTop: -5 }}>
      <Input
        className="hkp-fnt-family hkp-input-ghost"
        style={{ ...topMargin, height: 16, width: "100%" }}
        ref={(elem) => elem && elem.focus()}
        value={runtimeNameEditBuffer}
        onChange={(ev, { value: runtimeNameEditBuffer }) =>
          setRuntimeNameEditBuffer(runtimeNameEditBuffer)
        }
        onKeyUp={(ev: KeyboardEvent) => {
          if (ev.key === "Enter") {
            onChangeName(runtimeNameEditBuffer);
            setRuntimeNameEditBuffer("");
          } else if (ev.key === "Escape") {
            setRuntimeNameEditBuffer("");
          }
        }}
      />

      <div
        style={{
          ...topMargin,
          height: 18,
          width: 30,
          padding: 0,
          cursor: "pointer",
        }}
        onClick={() => setRuntimeNameEditBuffer("")}
      >
        <Icon style={s(t.m(5, 0))} name="close" color="grey" />
      </div>
    </div>
  ) : (
    <div
      style={{ cursor: "pointer", whiteSpace: "nowrap", fontWeight: "bold" }}
      title={runtimeId}
      onClick={() => !runtimeNameEditBuffer && setRuntimeNameEditBuffer(name)}
    >
      {name}
      <Icon style={s(t.m(5, 0))} name="pencil" color="grey" />
    </div>
  );
}
