import { CSSProperties } from "react";

type Props = {
  month: string;
  day: String;
  year: string;
  size: string;
};

export default function Date({ month, day, year, size = "m" }: Props) {
  const style: CSSProperties = {
    lineHeight: 1.5,
    textAlign: "right",
    fontSize: size === "s" ? 12 : size === "m" ? 13 : 14,
    textTransform: "capitalize",
  };
  return (
    <div className="hkp-fnt-family" style={style}>
      {month}, {day}. {year}
    </div>
  );
}
