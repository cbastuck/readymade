import Template from "../../../Template";

import { Section, Paragraph, ListItem, Text } from "../../Elements";
import Date from "../../../../components/Date";

import HkpLogo from "./assets/hkp-dots-round.svg?react";
import HkpBraidLogo from "./assets/hkp-dots-plait-linkedin.svg?react";
import HkpSingleEdgy from "./assets/hkp-single-dot-second-trial-edgy.svg?react";

export default function Brand() {
  return (
    <Template title="Identity" parent="Project Scope">
      <div className="py-10">
        <Date month="August" day="6" year="2022" size="s" />
        <Section title="Logos">
          <Text>
            <Paragraph brief="">
              <Logo svg={<HkpLogo />} />
              <Logo svg={<HkpLogo />} size="50%" />
              <Logo svg={<HkpLogo />} size="25%" />
            </Paragraph>
            <Paragraph brief="">
              <Logo size="15%" letters={false} svg={<HkpBraidLogo />} />
              <Logo size="10%" letters={false} svg={<HkpBraidLogo />} />
              <Logo size="5%" letters={false} svg={<HkpBraidLogo />} />
            </Paragraph>
            <Paragraph brief="">
              <Logo svg={<HkpSingleEdgy />} size="30px" />
            </Paragraph>
          </Text>
        </Section>
        <Section title="Interpretation">
          <Text>
            <Paragraph brief="The three dots (...)">
              <ListItem>
                indicate activity while texting and hence a connection.
              </ListItem>
              <ListItem>
                trigger a logical continuation at the end of a sentence ...
              </ListItem>
              <ListItem>are composable through repetition</ListItem>
            </Paragraph>
            <Date month="January" day="21" year="2023" size="s" />
            <Section title="Functional analogy">
              <div className="my-4">
                h(k(p)) - services: <code>h</code>, <code>k</code>, with
                parameters <code>p</code>.
              </div>
              <div>
                Read as: parameters <code>p</code> first go into service{" "}
                <code>k</code> and the result goes as input to service{" "}
                <code>h</code>
              </div>
            </Section>
          </Text>
        </Section>
      </div>
    </Template>
  );
}

function Logo({ size = "100%", filled = false, letters = true, svg = null }) {
  return <div style={{ width: size, margin: "20px auto" }}>{svg}</div>;
}
