import { Link } from "react-router-dom";

import Template from "../Template";

const fontStyle = {
  fontSize: 13,
  letterSpacing: 1,
};

export default function What() {
  return (
    <Template title="Documentation" isRoot={true}>
      <Article to="/docs/quickstart">Quickstarter</Article>
      <Chapter name="Project Scope">
        <Article to="/docs/pitch/what">What</Article>
        <Article to="/docs/pitch/why">Why</Article>
        <Article to="/docs/pitch/how">How</Article>
      </Chapter>
      <Chapter name="Side tracks" details="topics work in progress">
        <Article to="/docs/tracks/brand">brand and identity</Article>
      </Chapter>
    </Template>
  );
}

function Chapter({ name, children, details }) {
  const style = {
    ...fontStyle,
    marginLeft: 8,
    textTransform: "uppercase",
  };
  return (
    <div style={style}>
      {name}
      {details ? (
        <span style={{ fontSize: 11, textTransform: "none", paddingLeft: 10 }}>
          [{details || ""}]
        </span>
      ) : null}
      <div style={{ paddingLeft: 10 }}>{children}</div>
    </div>
  );
}

function Article({ children, to, separator = "" }) {
  return (
    <div>
      <div style={{ margin: "8px 0px" }}>
        {Array.isArray(to) ? (
          <>
            {to.map((dst, idx) => (
              <span key={`article-${dst}`}>
                <ChapterLink to={dst} title={children[idx]} />
                {idx < to.length - 1 ? <span>{separator}</span> : ""}
              </span>
            ))}
          </>
        ) : (
          <ChapterLink to={to} title={children} />
        )}
      </div>
    </div>
  );
}

function ChapterLink({ to, title }) {
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
