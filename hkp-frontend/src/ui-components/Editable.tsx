import { ChangeEvent, KeyboardEvent, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Props = {
  value: string;
  title?: string;
  onChangeName: (newValue: string) => void;
};

export default function Editable({ value, title, onChangeName }: Props) {
  const [editableBuffer, setEditableBuffer] = useState("");

  const onChange = (ev: ChangeEvent<HTMLInputElement>) => {
    const runtimeNameEditBuffer = ev.target.value;
    setEditableBuffer(runtimeNameEditBuffer);
  };

  const onKeyUp = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      onChangeName(editableBuffer);
      setEditableBuffer("");
    } else if (ev.key === "Escape") {
      setEditableBuffer("");
    }
  };

  const onEdit = () => !editableBuffer && setEditableBuffer(value);

  return (
    <div className="flex items-end h-full">
      {!editableBuffer ? (
        <Button
          variant="ghost"
          title={title}
          className="text-sm cursor-text p-0 h-min rounded-none"
          onClick={onEdit}
        >
          {value}
        </Button>
      ) : (
        <>
          <Input
            className="h-min w-min p-0 border-none rounded-none"
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
    </div>
  );
}
