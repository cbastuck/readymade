import { LinkType } from "./types";

import { t } from "../../../styles";

export default function Link(item: LinkType) {
  const { text = "text property missing", href = "#" } = item;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={t.fs11}>
      {text}
    </a>
  );
}
