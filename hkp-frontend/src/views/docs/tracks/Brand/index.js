import Template from "../../../Template";

import { ReactComponent as HkpLogo } from "./assets/hkp-dots-round.svg";

export default function Brand() {
  return (
    <Template title="Brand and Identity" isRoot={false}>
      <div style={{ margin: "40px 0px" }}>
        <Section title="Logo">
          <Logo />
          <Logo size="50%" />
          <Logo size="25%" />
          <Text>
            <Paragraph brief="Three dots symbolise ...">
              <ListItem>
                communication in texting and thus a connection
              </ListItem>
              <ListItem>
                logical continuation in the sense of what came before
              </ListItem>
              <ListItem>endless composition</ListItem>
            </Paragraph>
            <Paragraph brief="Abbreviation of term Hookup because  ...">
              <ListItem>
                leaving out vocals, as they carry informatiom mostly for
                pronunciation, less for understanding
              </ListItem>
              <ListItem>
                the odds are that Hookup is already taken for being used in this
                context.
              </ListItem>
            </Paragraph>
          </Text>
        </Section>
      </div>
    </Template>
  );
}

function Paragraph({ children, brief }) {
  return (
    <div style={{ margin: "20px 0px" }}>
      {brief}
      <div style={{ marginLeft: 25 }}>{children}</div>
    </div>
  );
}

function Logo({ size = "100%" }) {
  return (
    <div style={{ width: size, margin: "20px auto" }}>
      <HkpLogo />
    </div>
  );
}

function Section({ title, children }) {
  const headlineStyle = { textTransform: "uppercase", fontSize: 16 };
  return (
    <>
      <h1 style={headlineStyle}> {title}</h1>
      {children}
    </>
  );
}

function ListItem({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ width: 40 }}>-</div>
      <div> {children} </div>
    </div>
  );
}

function Text({ children }) {
  const style = {
    textTransform: "none",
    fontFamily: "roboto",
    fontSize: 16,
    letterSpacing: 1,
    lineHeight: 1.5,
  };
  return <div style={style}>{children} </div>;
}
