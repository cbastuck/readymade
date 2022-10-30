export function Paragraph({ children, brief, headline }) {
  const headlineStyle = {
    textTransform: "uppercase",
    fontSize: 12,
  };
  return (
    <div style={{ margin: "20px 0px" }}>
      {headline && <h1 style={headlineStyle}> {headline}</h1>}
      {brief}
      <div style={{ marginLeft: 20 }}>{children}</div>
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
