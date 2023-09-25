import { Link } from "react-router-dom";

import { fontStyle } from "./common";

type Props = {
  to: string;
  title: string;
};

export default function ChapterLink({ to, title }: Props) {
  const navItemStyle = {
    margin: 8,
    ...fontStyle,
    textTransform: "uppercase",
  };
  return (
    <Link to={to} style={navItemStyle}>
      {title}
    </Link>
  );
}
