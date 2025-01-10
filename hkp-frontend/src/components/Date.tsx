import { CSSProperties } from "react";

type Props = {
  className?: string;
  month: string;
  day: string;
  year: string;
  size?: string | number;
  isUpdate?: boolean;
};

export default function Date({
  className = "w-[33%]",
  month,
  day,
  year,
  size = "m",
  isUpdate = false,
}: Props) {
  const fontSize =
    typeof size === "number"
      ? size
      : size === "s"
      ? 12
      : size === "m"
      ? 13
      : 14;
  const style: CSSProperties = {
    fontSize,
    textTransform: "capitalize",
  };
  return (
    <div className={`font-sans ${className}`} style={style}>
      {isUpdate && (
        <span style={{ textTransform: "none" }}> last edited on </span>
      )}
      {month}, {day}. {year}
    </div>
  );
}
