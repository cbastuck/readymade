type Props = {
  month: string;
  day: String;
  year: string;
  size: string;
};

export default function Date({ month, day, year, size = "m" }: Props) {
  const style: any = {
    fontFamily: "roboto",
    letterSpacing: 1,
    lineHeight: 1.5,
    textAlign: "right",
    fontSize: size === "s" ? 13 : size === "m" ? 16 : 18,
    textTransform: "capitalise",
  };
  return (
    <div style={style}>
      {month}, {day}.{year}
    </div>
  );
}
