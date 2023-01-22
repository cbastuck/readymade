export default function Date({ month, day, year, size = "m" }) {
  const style = {
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
