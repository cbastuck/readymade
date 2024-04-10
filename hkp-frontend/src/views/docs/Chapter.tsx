import { ReactElement, CSSProperties } from "react";

import { fontStyle, detailStyle } from "./common";

type Props = {
  name: string;
  children: ReactElement[];
  details?: string;
  style?: object;
};

export default function Chapter({
  name,
  children,
  details,
  style: passedStyle = {},
}: Props) {
  const style: CSSProperties = {
    ...fontStyle,
    marginLeft: 8,
    ...passedStyle,
  };
  return (
    <div style={style}>
      {name}
      {details ? <span style={detailStyle}>[{details || ""}]</span> : null}
      <div style={{ paddingLeft: 10 }}>{children}</div>
    </div>
  );
}
