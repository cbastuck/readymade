import { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Item } from "semantic-ui-react";

import Sketch from "./Sketch";
import Template from "../Template";
import { s, t } from "../../styles";
import Claim from "./Claim";
import GroupItem from "./GroupItem";
import Button from "../../components/shared/Button";

export default function Quickstart() {
  const navigate = useNavigate();
  const sectionStyle: CSSProperties = {
    fontSize: 16,
    textAlign: "left",
    letterSpacing: 2,
  };

  return (
    <Template title="Quickstarter" isRoot={false}>
      <h2 style={{ ...sectionStyle, margin: "30px 0px" }}>Etiquette</h2>
      <div style={{ marginBottom: 35 }}>
        <Claim s="Please" c="Make stupid things!" />
        <Claim
          s="In particular"
          c="“Dance to all the wrong songs”"
          link="https://www.youtube.com/watch?v=NkAe30aEG5c"
          cite="D. Sandstrom, D. Lyxzen, K. Steen, J. Brannstrom"
        />
        <Claim
          s="Because"
          c='"Da fehlen Rebellen, da fehlen Dilettanten”'
          link="https://www.youtube.com/watch?v=rZ6TjOQQuTU"
          cite="Kapelle Petra"
        />
        <Claim
          s="Acknowledge"
          c="“Wir können alles. Und Alles können wir sein”"
          link="https://www.youtube.com/watch?v=GLAHeIEzaC8"
          cite="R. Sczimarkowsi, J. Windmeier, C. Knopp, M. Ebsen, C. Peter"
        />
        <Claim
          s="Understand"
          c="“Nur weil es dumm aussieht, muss es das nicht sein”"
          link="https://www.youtube.com/watch?v=IIw1nP4KEHs"
          cite=" K. Hamann, N. Kolodziej "
        />
        <Claim
          s="With respect"
          c='"To want more than is given to you”'
          link="https://www.youtube.com/watch?v=xk2CvKcJnC4"
          cite="G. Moakes, K. Okereke,  M. Tong, R. Lissackj"
        />
        <Claim
          s="Knowing"
          c="”I can't do this all on my own”"
          link="https://www.youtube.com/watch?v=SBl2l3GIFD4"
          cite="Lazlo Bane"
        />
      </div>
      <h1 style={s(t.tc, t.ls1, t.fs12, t.it, { color: "#4183c4" })}>
        <span style={t.fs16}>Do. </span>
        <span style={t.fs20}>Be curious!</span>
        <a href="https://cbastuck.de" target="blank">
          <span style={t.fs9}> talk.</span>
        </a>
      </h1>

      <h2
        style={{
          ...sectionStyle,
          marginTop: 30,
          marginBottom: 20,
        }}
      >
        Stuff to know about
      </h2>
      <div
        className=""
        style={s(t.fs14, {
          textAlign: "left",
          textTransform: "none",
        })}
      >
        <div style={{ marginBottom: 10 }}>
          To get started with Hookup, know three things:
          <span style={s(t.bold, t.m(5, 0))}>
            Board, Runtime, and Service.{" "}
          </span>
        </div>
        <div>
          Think of a <span style={t.bold}>Board</span> like a blank page, a{" "}
          <span style={t.bold}>Runtime</span> as a line on that page, and{" "}
          <span style={t.bold}>Services</span> as the words in that line. They
          work together to tell a story or create behavior.
        </div>
        <div style={{ padding: "8px 0px" }}>
          <Sketch />
        </div>
        <Item.Group link style={{ marginTop: 0, marginBottom: 0 }}>
          <GroupItem
            title="Board"
            details={[
              "A Board is the topmost building block. Everything happens on a board",
              "A Board is identified by a name",
              "A Board owns and manages an arbitrary number of runtimes",
              "A Board can run inside of the browser independently of a backend (Playground for example)",
              "A Board can also be managed by a remote backend which persists its state and requires the notion of a user",
              "A Board defines the topology of the runtimes: how they are organized and their order",
              "A Board is responsible for passing the output of a runtime to the next runtime",
            ]}
            image={undefined}
            bottomDivider={true}
          />
          <GroupItem
            title="Runtime"
            details={[
              "A Runtime belongs to exactly one board",
              "A Runtime's lifetime ends with the lifetime of its parent board",
              "A Runtime can run inside of the browser or on a remote machine",
              "Runtimes running in the browser can be mixed with remote runtimes on the same board",
              "A Runtime owns and manages an arbitrary number of services",
              "A Runtime accepts data on its input and passes it to its services",
              "A Runtime calls services in order from left to right propagating the incoming data",
              "A Runtime provides the result of the last service as its output",
            ]}
            image={undefined}
            bottomDivider={true}
          />
          <GroupItem
            title="Service"
            details={[
              "Services are (high level) abstractions of (complex) logic",
              "Services are supposed to feel simple and intuitive",
              "Services have an input and an output",
              "Services need a configuration that can be modified or retrieved at any time",
              "A Service configuration defines the mode of the service",
              "Services behave differently depending on their configuration",
              "A Service can generate data spontaneously and trigger a chain reaction",
              "A Service can also decide to stop further propagation",
            ]}
            image={undefined}
          />
        </Item.Group>
      </div>

      <Button
        onClick={() => navigate("/examples")}
        style={{ marginBottom: "50px", width: "100%" }}
      >
        Examples
      </Button>
    </Template>
  );
}
