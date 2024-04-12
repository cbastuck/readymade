import { Link } from "react-router-dom";

export default function Intro() {
  return (
    <>
      <h2>Basic</h2>
      <div style={{ margin: "30px 20px" }}>
        <div className="font-serif-wet tracking-widest">
          The examples below showcase just a glimpse of the possibilities. They
          all run in a Sandbox, designed for constructing flows that primarily
          operate locally without the need for a login. Much more is possible
          when combining remote and local runtimes on one board. For a deeper
          exploration of advanced features, visit
          <Link to="/playground"> Playground</Link>.
        </div>
      </div>
    </>
  );
}
