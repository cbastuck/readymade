import { useState, useEffect } from "react";

import Template from "../../../Template";
import { Section, Paragraph, Text } from "../../Elements";
import Code from "../../../../components/Code";
import CodeBlock from "../../../../components/CodeBlock";
import Date from "../../../../components/Date";
import Info from "../../../../components/Info";

import spreadsheetImage from "./spreadsheet.png";
import templateRuntimeImage from "./templateRuntime.png";

export default function Bridge() {
  const [template, setTemplate] = useState("");
  const [jsCode, setJSCode] = useState("");
  useEffect(() => {
    const fetchData = async () => {
      setTemplate(
        await (
          await fetch(
            `${window.location.protocol}//bridge.${window.location.hostname}/template.html`
          )
        ).text()
      );
      setJSCode(
        await (
          await fetch(
            `${window.location.protocol}//bridge.${window.location.hostname}/script.js`
          )
        ).text()
      );
    };
    fetchData();
  }, []);
  return (
    <Template title="Bridge" parent="side tracks">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Idea">
            <Paragraph>
              The Bridge allows integrating hookup runtimes into HTML documents.
              Any board is just a JSON document and playground boards run in the
              browser only (in case no dependencies to external remote
              runtimes). Therefore, runtimes from playground boards can
              seamlessly run on any website where they execute on the visitor's
              device.
            </Paragraph>
          </Section>
          <Section title="Example">
            <Paragraph>
              Visit{" "}
              <a
                href={`${window.location.protocol}//bridge.${window.location.host}`}
                target="_blank"
                rel="noreferrer"
              >
                {`${window.location.protocol}//bridge.${window.location.host}`}
              </a>{" "}
              for a basic example.
            </Paragraph>
            <Paragraph>
              The idea of this demo is to tell a story by combining three media
              elements: text,{" "}
              <a href="https://unsplash.com" target="_black" rel="noreferrer">
                image
              </a>
              ,{" "}
              <a href="https://spotify.com" target="_black" rel="noreferrer">
                music
              </a>
              . Taken individually, these elements are not connected to each
              other in any way. Putting them together creates a new context,
              which might be interesting, funny, inspiring or anything else
              depending on the observer.
            </Paragraph>
            <Paragraph>
              The combination (rows) of media elements (columns) are collected
              in a spreadsheet using the Excel format. Every row of this table
              gets selected, converted to JSON and passed as input data to a
              HTML template, where template variables are replaced with the
              value of their corresponding column. You can step through the rows
              by clicking somewhere on the image, or using the arrow keys.
            </Paragraph>
          </Section>
          <Section title="Description">
            <Paragraph headline="Template Runtime">
              A runtime is responsible fetching data from a spreadsheet (serves
              as CMS in this example), converting the data from the binary excel
              format into a JSON object, selecting a particular row, adding
              derived data from existing columns and finally applying the mapped
              result to a HTML template.
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  margin: "10px 0px",
                  overflow: "auto",
                }}
              >
                <img
                  src={templateRuntimeImage}
                  width="150%"
                  alt="template runtime"
                />
              </div>
            </Paragraph>
            The <CodeBlock title="HTML Template">{template}</CodeBlock> renders
            a referenced image from{" "}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer">
              Unsplash
            </a>
            , adds a text-box and embeds a track from{" "}
            <a href="https://spotify.com">Spotify</a> using an iframe.
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                width: "100%",
                marginTop: 10,
              }}
            >
              <div style={{ width: "100%" }}>
                Data in the spreadsheet is organised in rows and named columns
                (as specified in first row) The HTLM tempalte references row
                values by their corresponding column names arusing a double
                bracket notation, e.g.{" "}
                <code style={{ fontFamily: "courier" }}>[[link]]</code>
              </div>

              <div
                style={{
                  width: "80%",
                  textAlign: "center",
                  margin: "0px 15px",
                }}
              >
                <img
                  src={spreadsheetImage}
                  width="100%"
                  alt="spreadsheet document"
                />
              </div>
            </div>
            <Paragraph headline="Hookup the runtime">
              The <CodeBlock title="script">{jsCode}</CodeBlock>{" "}
              programmatically instantiates the runtimes and configures them
              using the Bridge's API. Whenever the user clicks on a blank space
              in the document (HTML body), the script reconfigures the select
              module and data from the next row from the spreadsheet is applied
              to the HTML template.
            </Paragraph>
          </Section>

          <Section title="General bridge API">
            <Paragraph>
              1. Add the following <code>script</code> tag into the document's
              html header
              <Paragraph>
                <Code>{`<script src="https://hookup.to/bridge/bridge.js"> </script> `}</Code>
              </Paragraph>
              2. Initialise the hookup board's peer input and output channel.
              Any peer needs a unique name
              <Paragraph>
                <Code>{initCode}</Code>
              </Paragraph>
            </Paragraph>
            <Paragraph>
              3. Go to{" "}
              <a
                href="/playground/bridge-board"
                target="_blank"
                rel="noreferrer"
              >
                {" Playground "}
              </a>
              and build your board then get the board's source and save it.
            </Paragraph>
            <Paragraph>
              4. Grab the board's source by going to the{" "}
              <a
                href="/playground/bridge-board/src"
                target="_blank"
                rel="noreferrer"
              >
                {" board's source view"}.
              </a>
              <Info>
                Note: access the source of any saved playground board by
                appending
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
          </Section>
          <Info>
            Note: The subscription object is actually a{" "}
            <a href="https://rxjs.dev/guide/subscription">rxjs subscription</a>{" "}
            and receives any output from the runtime that was created inside the
            bridged runtime.
          </Info>

          <Date month="October" day="30" year="2022" />
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
