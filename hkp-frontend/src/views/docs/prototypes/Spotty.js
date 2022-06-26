import { Link } from "react-router-dom";

import Template from "../../Template";

import { Section, Text } from "../Elements";

export default function Spotty() {
  return (
    <Template title="Spotty" parent="proto log">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Spotify Favs -> Github">
            Show it on{" "}
            <Link to="/playground/spotty?template=/boards/protos/spotty.json">
              Playground
            </Link>
          </Section>
        </Text>
      </div>
    </Template>
  );
}
