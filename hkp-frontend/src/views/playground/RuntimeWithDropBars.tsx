import { DragEvent, useContext, useState } from "react";
import { ThemeCtx } from "@/ui-components/ThemeContext";
import { HKP_DND_RUNTIME_TYPE } from "@/components/DropTarget";

type Props = {
  index: number;
  children: JSX.Element;
  onDrop: (runtimeId: string, index: number) => void;
};
export default function RuntimeWithDropBar({ children, index, onDrop }: Props) {
  const [active, setActive] = useState(false);
  const onDropBar = (ev: DragEvent) => {
    setActive(false);
    const data = ev.dataTransfer.getData(HKP_DND_RUNTIME_TYPE);
    if (data) {
      const rt = JSON.parse(data);
      onDrop && onDrop(rt.id, index);
    }
  };
  return (
    <div className="flex flex-col">
      <DropBar active={active} setActive={setActive} onDrop={onDropBar} />
      {children}
    </div>
  );
}

function DropBar({
  active,
  setActive,
  onDrop,
}: {
  active: boolean;
  setActive: (newActive: boolean) => void;
  onDrop: (ev: DragEvent) => void;
}) {
  const theme = useContext(ThemeCtx);
  return (
    <div
      className="w-full h-[5px]"
      style={{
        background: active ? `${theme.dropBarColor} ` : undefined,
        marginTop: -5,
      }}
      onDragOver={(ev) => {
        if (ev.dataTransfer.types.includes(HKP_DND_RUNTIME_TYPE)) {
          setActive(true);
          ev.preventDefault();
        }
      }}
      onDragLeave={(_ev) => setActive(false)}
      onDrop={onDrop}
    />
  );
}
