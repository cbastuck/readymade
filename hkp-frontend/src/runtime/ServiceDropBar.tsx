import { ThemeCtx } from "@/ui-components/ThemeContext";
import { useContext, useState } from "react";

type Props = {
  index: number;
  onDrop: (svcUuid: string, pos: number) => void;
};

export default function ServiceDropBar(props: Props) {
  const [active, setActive] = useState(false);
  const { onDrop, index } = props;
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
      onDrop={(ev) => {
        setActive(false);
        const data = ev.dataTransfer.getData("text/plain");
        if (data) {
          const svc = JSON.parse(data);
          onDrop && onDrop(svc.uuid, index);
        }
      }}
    />
  );
}
