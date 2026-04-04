import { ChangeEvent, KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import Tooltip, { TooltipContentType } from "./Tooltip";

import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

type Props = {
  id?: string;
  value: string;
  title?: string;
  className?: string;
  tooltip?: TooltipContentType;
  onChange: (newValue: string) => void;
};

export default function Editable({
  id,
  value,
  title,
  className,
  tooltip,
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
          id={id}
          variant="ghost"
          title={title}
          className={`cursor-text p-0 h-min rounded-none whitespace-nowrap text-base font-sans tracking-widest ${
            className || ""
          }`}
          onClick={onEdit}
        >
          {tooltip ? (
            <Tooltip value={tooltip}>
              <div>{value}</div>
            </Tooltip>
          ) : (
            value
          )}
        </Button>
      ) : (
        <div className="flex items-end">
          <Input
            id={id}
            className={`h-min w-min p-0 border-none rounded-none font-sans text-base tracking-widest bg-transparent ${
              className || ""
            }`}
            style={{
              borderBottom: "solid 1px",
              paddingBottom: "1px",
            }}
            ref={(elem) => { if (elem) elem.focus(); }}
            value={editableBuffer}
            onChange={onChange}
            onKeyUp={onKeyUp}
          />
          <Button
            className="w-min h-min"
            variant="ghost"
            size="icon"
            onClick={() => setEditableBuffer("")}
          >
            <X strokeWidth={1} style={{ margin: 0 }} />
          </Button>
        </div>
      )}
    </>
  );
}
