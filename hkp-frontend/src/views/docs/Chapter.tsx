import { ReactElement } from "react";

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
  const style: any = {
    ...fontStyle,
    marginLeft: 8,
    textTransform: "uppercase",
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
