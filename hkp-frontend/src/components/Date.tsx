import { CSSProperties } from "react";

type Props = {
  month: string;
  day: String;
  year: string;
  size: string;
};

export default function Date({ month, day, year, size = "m" }: Props) {
  const style: CSSProperties = {
    fontFamily: "roboto",
    letterSpacing: 1,
    lineHeight: 1.5,
    textAlign: "right",
    fontSize: size === "s" ? 13 : size === "m" ? 16 : 18,
    textTransform: "capitalize",
  };
  return (
    <div style={style}>
      {month}, {day}.{year}
    </div>
  );
}
