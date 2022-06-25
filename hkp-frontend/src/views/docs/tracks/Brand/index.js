import Template from "../../../Template";

import { Section, Paragraph, ListItem, Text } from "../../Elements";

import { ReactComponent as HkpLogo } from "./assets/hkp-dots-round.svg";
import { ReactComponent as HkpLogoFill } from "./assets/hkp-dots-small-spaced.svg";

export default function Brand() {
  return (
    <Template title="Brand and Identity" parent="side tracks">
      <div style={{ margin: "40px 0px" }}>
        <Section title="Logo">
          <Logo />
          <Logo size="50%" />
          <Logo size="25%" />
          <Logo size="4%" filled={true} />
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
            </Paragraph>
            <Paragraph brief="Removing the vocals ...">
              <ListItem>
                as they carry informatiom mostly for pronunciation, less for
                understanding
              </ListItem>
              <ListItem>
                as the odds are that Hookup is already taken for being used in
                this context.
              </ListItem>
            </Paragraph>
          </Text>
        </Section>
      </div>
    </Template>
  );
}

function Logo({ size = "100%", filled = false }) {
  return (
    <div style={{ width: size, margin: "20px auto" }}>
      {filled ? <HkpLogoFill /> : <HkpLogo />}
    </div>
  );
}
