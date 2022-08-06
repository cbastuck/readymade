export default function Date({ month, day, year }) {
  const style = {
    fontFamily: "roboto",
    letterSpacing: 1,
    lineHeight: 1.5,
    textAlign: "right",
    fontSize: 16,
    textTransform: "capitalise",
  };
  return (
    <div style={style}>
      {month}, {day}. {year}
    </div>
  );
}
