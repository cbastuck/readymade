import Template from "../../../Template";

import { Section, Paragraph, ListItem, Text } from "../../Elements";
import Date from "../../../../components/Date";

import { ReactComponent as HkpLogo } from "./assets/hkp-dots-round.svg";
import { ReactComponent as HkpBraidLogo } from "./assets/hkp-dots-plait-linkedin.svg";
import { ReactComponent as HkpSingleEdgy } from "./assets/hkp-single-dot-second-trial-edgy.svg";

export default function Brand() {
  return (
    <Template title="Brand and Identity" parent="side tracks">
      <div style={{ margin: "40px 0px" }}>
        <Date month="August" day="6" year="2022" size="s" />
        <Section title="Logo">
          <Text>
            <Paragraph brief="Initial draft: render three dots with vowels of the project name">
              <Logo svg={<HkpLogo />} />
              <Logo svg={<HkpLogo />} size="50%" />
              <Logo svg={<HkpLogo />} size="25%" />
            </Paragraph>
            <Paragraph brief="Alternative: renders better in the size of an icon">
              <Logo size="15%" letters={false} svg={<HkpBraidLogo />} />
              <Logo size="10%" letters={false} svg={<HkpBraidLogo />} />
              <Logo size="5%" letters={false} svg={<HkpBraidLogo />} />
            </Paragraph>
            <Paragraph brief="Single dot as symbol and favicon (WIP)">
              <Logo svg={<HkpSingleEdgy />} size="30px" />
            </Paragraph>
          </Text>
        </Section>
        <Section title="Interpretation">
          <Text>
            <Paragraph brief="Three dots symbolise ...">
              <ListItem>
                communication while texting and thus a connection
              </ListItem>
              <ListItem>
                logical continuation in the sense of what came before
              </ListItem>
              <ListItem>
                endless composition, there is more than currently visible
              </ListItem>
              <ListItem>
                elements of a braid in the alternative version
              </ListItem>
              <ListItem>
                elements of a bicycle chain in the alternative version
              </ListItem>
            </Paragraph>
            <Paragraph brief="Removing vowels ...">
              <ListItem>
                as they carry information mostly for pronunciation, less for
                understanding
              </ListItem>
              <ListItem>
                as the odds are that Hookup is already taken for being used in
                such context.
              </ListItem>
            </Paragraph>
            <Date month="January" day="21" year="2023" size="s" />
            <Paragraph brief="In functional notation a representation of the smallest valuable building block ...">
              <div>
                a runtime consisting of two services: <code>h</code> and{" "}
                <code>k</code>, with parameters <code>p</code> floating from
                input to output while being transformed and producing the
                result:
                <span style={{ marginLeft: 10 }}>
                  <code>h(k(p))</code>
                </span>
              </div>
            </Paragraph>
          </Text>
        </Section>
      </div>
    </Template>
  );
}

function Logo({ size = "100%", filled = false, letters = true, svg = null }) {
  return <div style={{ width: size, margin: "20px auto" }}>{svg}</div>;
}
