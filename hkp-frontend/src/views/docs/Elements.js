export function Paragraph({ children, brief }) {
  return (
    <div style={{ margin: "20px 0px" }}>
      {brief}
      <div style={{ marginLeft: 25 }}>{children}</div>
    </div>
  );
}

export function Section({ title, children }) {
  const headlineStyle = { textTransform: "uppercase", fontSize: 16 };
  return (
    <>
      <h1 style={headlineStyle}> {title}</h1>
      {children}
    </>
  );
}

export function ListItem({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ width: 40 }}>-</div>
      <div> {children} </div>
    </div>
  );
}

export function Text({ children }) {
  const style = {
    textTransform: "none",
    fontFamily: "roboto",
    fontSize: 16,
    letterSpacing: 1,
    lineHeight: 1.5,
  };
  return <div style={style}>{children} </div>;
}
