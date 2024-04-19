import { ReactElement } from "react";

import { detailStyle } from "./common";

type Props = {
  name: string;
  children: ReactElement[];
  details?: string;
  style?: object;
};

export default function Chapter({ name, children, details }: Props) {
  return (
    <div className="font-sans text-xl">
      {name}
      {details ? <span style={detailStyle}>[{details || ""}]</span> : null}
      <div className="px-8 text-lg">{children}</div>
    </div>
  );
}
