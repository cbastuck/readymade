import Template from "../../../Template";

import { Section, Paragraph, Text } from "../../Elements";
import Code from "../../../../components/Code";
import Date from "../../../../components/Date";
import Info from "../../../../components/Info";

export default function Bridge() {
  return (
    <Template title="The Bridge" parent="side tracks">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Idea">
            <Paragraph>
              The bridge allows integrating boards into vanilla html documents.
              Remember, any board can be described as a JSON document. Since
              playground boards run only in the browser (when used without
              dependencies to external remote runtimes), their JSON descriptions
              can easily be integrated into other sites. The board will be
              executed exclusively on the visitor's device.
            </Paragraph>
          </Section>
          <Section title="Steps"></Section>
          <Paragraph>
            1. Add the following <code>script</code> tag into the document's
            html header
            <Paragraph>
              <Code>{`<script src="https://hookup.to/bridge/bridge.js"> </script> `}</Code>
            </Paragraph>
            2. Initialise the hookup board's peer input and output channel. Any
            peer needs a unique name
            <Paragraph>
              <Code>{initCode}</Code>
            </Paragraph>
          </Paragraph>
          <Paragraph>
            3. Go to{" "}
            <a href="/playground/bridge-board" target="_blank">
              {" Playground "}
            </a>
            and build your board then get the board's source and save it.
          </Paragraph>
          <Paragraph>
            4. Grab the board's source by going to the{" "}
            <a href="/playground/bridge-board/src" target="_blank">
              {" board's source view"}.
            </a>
            <Info>
              Note: access the source of any saved playground board by appending
              <code>/src</code> to the end URL in the browser.
            </Info>
          </Paragraph>
          <Paragraph>
            5. Create a runtime within the bridge using the{" "}
            <code>services</code> from the grabbed source.
            <Paragraph>
              <Code>{runtimeCode}</Code>
            </Paragraph>
          </Paragraph>
          <Info>
            Note: The subscription object is actually a{" "}
            <a href="https://rxjs.dev/guide/subscription">rxjs subscription</a>{" "}
            and receives any output from the runtime that was created inside the
            bridged runtime.
          </Info>
          <Section title="Example">
            <Paragraph>
              Go to{" "}
              <a href="/bridge.html" target="_blank">
                {`${window.location.protocol}//${window.location.host}/bridge.html`}
              </a>
            </Paragraph>
          </Section>
          <Date month="August" day="21" year="2022" />
        </Text>
      </div>
    </Template>
  );
}

const initCode = `window.hookup.to(
    "my-bridge-peer",
    {
        onPeer: (name, peer) => 
            peer.listAllPeers(peers => 
                console.log('Found other peers', peers)),
        onData: (data, peer) => c
            console.log('Received data', data)
    }
);`;

const runtimeCode = `const services = {
  "<runtimeId>": [ /* ... from the src ... */ ]
};
const rt = hookup.buildRuntime({runtimeId, runtimeName, services, expanded: false});
const subscription = rt.subscribe({
  next: (data) => console.log('Update ', data),
  error: (err) => console.error('Error: ', err),
  complete: () => console.log('Completed'),
});

// ... later at some point
subscription.unsubscribe();
`;
