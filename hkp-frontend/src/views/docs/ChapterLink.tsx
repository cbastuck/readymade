import { Link } from "react-router-dom";

import { fontStyle } from "./common";
import { CSSProperties } from "react";

type Props = {
  to: string;
  title: string;
};

export default function ChapterLink({ to, title }: Props) {
  const navItemStyle: CSSProperties = {
    margin: 8,
    ...fontStyle,
  };
  return (
    <Link to={to} style={navItemStyle}>
      {title}
    </Link>
  );
}
