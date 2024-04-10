import { CSSProperties } from "react";

type Props = {
  month: string;
  day: String;
  year: string;
  size?: string | number;
  isUpdate?: boolean;
};

export default function Date({
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
    lineHeight: 1.5,
    textAlign: "right",
    fontSize,
    textTransform: "capitalize",
  };
  return (
    <div className="" style={style}>
      {isUpdate && (
        <span style={{ textTransform: "none" }}> last edited on </span>
      )}
      {month}, {day}. {year}
    </div>
  );
}
