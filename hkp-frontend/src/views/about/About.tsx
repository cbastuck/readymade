import { Component } from "react";

import Toolbar from "../../components/Toolbar";
import Footer from "@/components/Footer";
import Switcher from "../../components/Switcher";

import "./About.css";
import Contact from "./Contact";

type Props = {
  isCompact?: boolean;
};

export default class About extends Component<Props> {
  render() {
    const amp = {
      fontSize: " 22",
      letterSpacing: 2,
    };
    return (
      <div>
        <Toolbar isCompact={!!this.props.isCompact} />
        <div className="about-image container">
          <div className="about-text">
            <Switcher animate={true} data={["About", "Intent"]} />
            <div
              style={{
                marginTop: 30,
                marginBottom: 0,
                fontSize: 20,
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <p>
                <span style={amp}>Enable</span>{" "}
                <span style={{ fontStyle: "italic" }}>everybody</span> to play
                with technical concepts
              </p>
              <p>
                Seed <span style={amp}>Inspiration</span> and{" "}
                <span style={amp}>Curiosity</span>{" "}
              </p>
              <p>
                Spawn <span style={amp}>Creativity</span>
              </p>
              <p>
                <span style={amp}>Improvise</span> with complexity.
              </p>
              <div style={{ paddingTop: "40px" }}>
                <Contact />
              </div>
            </div>
          </div>
        </div>
        <Footer isCompact={!!this.props.isCompact} />
      </div>
    );
  }
}
