import { useState } from "react";
import { Input } from "semantic-ui-react";
import { Button } from "@/components/ui/button";
import { Pen, X } from "lucide-react";

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
  return (
    <div style={{ display: "flex", flexDirection: "row", marginTop: -5 }}>
      {runtimeNameEditBuffer ? (
        <>
          <Input
            className="hkp-fnt-family hkp-input-ghost"
            style={{ ...topMargin, height: 16, width: "100%" }}
            ref={(elem) => elem && elem.focus()}
            value={runtimeNameEditBuffer}
            onChange={(_ev, { value: runtimeNameEditBuffer }) =>
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

          <Button variant="ghost" onClick={() => setRuntimeNameEditBuffer("")}>
            <X />
          </Button>
        </>
      ) : (
        <>
          {name}
          <Button
            variant="ghost"
            title={runtimeId}
            onClick={() =>
              !runtimeNameEditBuffer && setRuntimeNameEditBuffer(name)
            }
          >
            <Pen />
          </Button>
        </>
      )}
    </div>
  );
}
