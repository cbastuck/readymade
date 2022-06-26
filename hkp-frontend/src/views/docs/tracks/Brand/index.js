import Template from "../../../Template";

import { Section, Paragraph, ListItem, Text } from "../../Elements";

import { ReactComponent as HkpLogo } from "./assets/hkp-dots-round.svg";
import { ReactComponent as HkpLogoFill } from "./assets/hkp-dots-small-spaced.svg";
import { ReactComponent as HkpLogoNoLetters } from "./assets/hkp-dots-plait-linkedin.svg"; //"./assets/hkp-dots-chain-v1.svg";

export default function Brand() {
  return (
    <Template title="Brand and Identity" parent="side tracks">
      <div style={{ margin: "40px 0px" }}>
        <Section title="Logo">
          <Text>
            <Paragraph brief="Initial draft: render three dots with vowels of the project name">
              <Logo />
              <Logo size="50%" />
              <Logo size="25%" />
            </Paragraph>
            <Paragraph brief="Alternative: renders better in the size of an icon">
              <Logo size="15%" letters={false} />
              <Logo size="10%" letters={false} />
              <Logo size="5%" letters={false} />
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
            <Paragraph brief="Removing the vowel ...">
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

function Logo({ size = "100%", filled = false, letters = true }) {
  return (
    <div style={{ width: size, margin: "20px auto" }}>
      {filled ? <HkpLogoFill /> : letters ? <HkpLogo /> : <HkpLogoNoLetters />}
    </div>
  );
}
