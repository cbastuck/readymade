import { useNavigate } from "react-router-dom";
import Text from "hkp-frontend/src/ui-components/Text";
import Sketch from "./Sketch";
import Template from "../Template";
import { s, t } from "../../styles";
import Claim from "./Claim";
import GroupItem from "./GroupItem";
import Button from "hkp-frontend/src/ui-components/Button";

export default function Quickstart() {
  const navigate = useNavigate();

  return (
    <Template title="Quickstarter" isRoot={false}>
      <h1 style={{ margin: "30px 0px" }}>Etiquette</h1>
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
          link="https://www.youtube.com/watch?v=U4zMv-yAxtQ"
          cite="Lazlo Bane"
        />
      </div>
      <h1 style={s(t.tc, t.ls1, t.fs12, t.it, { color: "#4183c4" })}>
        <span className="text-xl">Do. </span>
        <span className="text-2xl">Be curious. </span>
        <a href="https://cbastuck.de" target="blank">
          <span className="text-3xl">Make.</span>
        </a>
      </h1>

      <h1
        style={{
          marginTop: 30,
          marginBottom: 20,
        }}
      >
        Stuff to know about
      </h1>
      <div
        style={s(t.fs14, {
          textAlign: "left",
          textTransform: "none",
        })}
      >
        <Text style={{ marginBottom: 10 }}>
          There are three important entities that are your building blocks:
          <span style={s(t.bold, t.m(5, 0))}>
            Board, Runtime, and Service.{" "}
          </span>
        </Text>
        <Text>
          Think of a <span style={t.bold}>Board</span> like a blank page, a{" "}
          <span style={t.bold}>Runtime</span> as a line on that page, and{" "}
          <span style={t.bold}>Services</span> as the words in that line. They
          work together to tell a story or create behavior.
        </Text>
        <div style={{ padding: "8px 0px" }}>
          <Sketch />
        </div>
        <div className="flex flex-col">
          <GroupItem
            title="Board"
            details={[
              "A Board is the topmost building block. Everything happens on a board.",
              "A Board is identified by a name.",
              "A Board owns and manages an arbitrary number of runtimes.",
              "A Board runs inside the browser or a standalone desktop (or later mobile) application.",
              "A Board defines the topology of the runtimes, meaning how the runtimes are ordered and how they are executed.",
              "A Board is responsible for passing the output of one runtime to the following, or return the data as the board result if no runtime follows.",
            ]}
            image={undefined}
            bottomDivider={true}
          />
          <GroupItem
            title="Runtime"
            details={[
              "A Runtime belongs to exactly one board.",
              "A Runtime's lifetime ends with the lifetime of its parent board.",
              "A Runtime can run inside the browser or a standalone application, either on the same or a remote machine.",
              "A Runtime owns and manages an arbitrary number of services.",
              "A Runtime accepts data on its input and passes it to its services.",
              "A Runtime calls services in order from left to right, propagating the incoming data.",
              "A Runtime provides the result of the last service as its output.",
            ]}
            image={undefined}
            bottomDivider={true}
          />
          <GroupItem
            title="Service"
            details={[
              "Services are abstractions of meaningful high-level behavior.",
              "Services are supposed to feel simple and intuitive.",
              "Services have an input and an output.",
              "Services keep a configuration that can be modified or retrieved at any time.",
              "A Service's configuration defines the details of the produced behavior.",
              "A Service can generate data spontaneously and with this trigger a chain reaction.",
              "A Service can decide to stop propagating incoming data and cancel the whole flow.",
            ]}
            image={undefined}
          />
        </div>
      </div>

      <Button
        onClick={() => navigate("/docs/updates")}
        style={{ marginBottom: "50px", width: "100%" }}
      >
        Next: What's new
      </Button>
    </Template>
  );
}
