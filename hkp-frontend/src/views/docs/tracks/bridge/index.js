import Template from "../../../Template";

import { Section, Paragraph, Text } from "../../Elements";

export default function Bridge() {
  return (
    <Template title="The Bridge" parent="side tracks">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Idea">
            <Paragraph>
              The bridge allows integrating boards into vanilla html documents.
              Any board can be described as a JSON document. Since playground
              boards run in the browser (currently without dependencies to
              external remote runtimes), their JSON descriptions can easily be
              integrated into other sites. They will be executed on the
              visitor's device.
            </Paragraph>
          </Section>
          <Section title="Example"></Section>
          <Paragraph>
            First add the following <code>script</code> tag into the document's
            html header
            <Paragraph>
              <code>{`<script src="https://hookup.to/bridge/bridge.js"> </script> `}</code>
            </Paragraph>
            Initialise the hookup board's peer input and output channel. Any
            peer needs a unique name
            <Paragraph>
              <code>
                {`
                    window.hookup.to(
                        "my-brdige-peer,
                    {
                      onPeer: (name, peer) => peer.listAllPeers(peers => console.log('Found peers', peers)),
                      onData: (data, peer) => console.log('Received data', data)
                    }
                );`}
              </code>
            </Paragraph>
          </Paragraph>
          <Section title="Demo">
            <Paragraph>
              Go to{" "}
              <a href="/bridge.html" target="_blank">
                Demo
              </a>
            </Paragraph>
          </Section>
        </Text>
      </div>
    </Template>
  );
}
