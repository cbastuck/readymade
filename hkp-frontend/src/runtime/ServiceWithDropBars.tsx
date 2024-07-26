import { ThemeCtx } from "@/ui-components/ThemeContext";
import { DragEvent, useContext, useState } from "react";

type Props = {
  index: number;
  allowDropBehind: boolean;
  children: JSX.Element;
  onDrop: (svcUuid: string, pos: number) => void;
};

export default function ServiceWithDropBar(props: Props) {
  const [active, setActive] = useState(false);
  const [lastActive, setLastActive] = useState(false);
  const { onDrop, index } = props;
  return (
    <div className="flex">
      <DropBar
        active={active}
        setActive={setActive}
        onDrop={(ev) => {
          setActive(false);
          const data = ev.dataTransfer.getData("text/plain");
          if (data) {
            const svc = JSON.parse(data);
            onDrop && onDrop(svc.uuid, index);
          }
        }}
      />
      {props.children}
      {props.allowDropBehind && (
        <DropBar
          active={lastActive}
          setActive={setLastActive}
          onDrop={(ev) => {
            setLastActive(false);
            const data = ev.dataTransfer.getData("text/plain");
            if (data) {
              const svc = JSON.parse(data);
              onDrop && onDrop(svc.uuid, index + 1);
            }
          }}
        />
      )}
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
      style={{
        width: 20,
        height: "94%",
        margin: "10px 0px",
        borderRadius: 3,
        background: active
          ? `linear-gradient(to right, #ffffff00 0%, #ffffff00 30%, ${theme.dropBarColor} 50%, #ffffff00 70%)`
          : undefined,
      }}
      onDragOver={(ev) => {
        setActive(true);
        ev.preventDefault();
      }}
      onDragLeave={(_ev) => setActive(false)}
      onDrop={onDrop}
    />
  );
}
