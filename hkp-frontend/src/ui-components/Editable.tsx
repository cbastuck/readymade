import { ChangeEvent, KeyboardEvent, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  title?: string;
  onChange: (newValue: string) => void;
};

export default function Editable({
  value,
  title,
  onChange: onChangeProp,
}: Props) {
  const [editableBuffer, setEditableBuffer] = useState("");

  const onChange = (ev: ChangeEvent<HTMLInputElement>) => {
    const runtimeNameEditBuffer = ev.target.value;
    setEditableBuffer(runtimeNameEditBuffer);
  };

  const onKeyUp = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      onChangeProp(editableBuffer);
      setEditableBuffer("");
    } else if (ev.key === "Escape") {
      setEditableBuffer("");
    }
  };

  const onEdit = () => !editableBuffer && setEditableBuffer(value);

  return (
    <>
      {!editableBuffer ? (
        <Button
          variant="ghost"
          title={title}
          className="cursor-text p-0 h-min rounded-none whitespace-nowrap text-base font-sans tracking-widest"
          onClick={onEdit}
        >
          {value}
        </Button>
      ) : (
        <>
          <Input
            className="h-min w-min p-0 border-none rounded-none font-sans text-base tracking-widest"
            style={{ borderBottom: "solid 1px", paddingBottom: "1px" }}
            ref={(elem) => elem && elem.focus()}
            value={editableBuffer}
            onChange={onChange}
            onKeyUp={onKeyUp}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditableBuffer("")}
          >
            <X strokeWidth={1} style={{ margin: 0 }} />
          </Button>
        </>
      )}
    </>
  );
}
