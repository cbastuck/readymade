import Template from "../../../Template";

import { Section, Paragraph, Text } from "../../Elements";

export default function Remotes() {
  return (
    <Template title="Remote runtimes" parent="Tracks">
      <div style={{ margin: "40px 0px" }}>
        <Section title="The Remote Engine">
          <Text>
            <Paragraph>
              The sample boards on this site mostly use browser runtimes and
              thus your local resource available through the browser.
            </Paragraph>
            <Paragraph>
              Strictly speaking the term browser runtime is not correct. This
              addresses a concrete runtime running in the browser. Actually I'm
              not referring to a single runtime here, but all the runtimes that
              run in this environment. A better term would be Browser Engine, an
              engine that creates runtimes that run inside your local browser
              environment.
            </Paragraph>
            <Paragraph>
              Browser engines can only access resources available to the current
              local machine. In comparision a Remote Engine can create runtimes
              that run on a remote (or local) machine, ie. is not limited to the
              browser environment. Hence, remote runtimes could access all
              resources from that device, ie. persistent storage, physical
              memory, operating system entities like the clipboard, server
              sockets, shared memory, processes, etc.
            </Paragraph>
            <Paragraph>
              Certainly this immediately feels like a security risk. The browser
              environment is sandboxed and security details and implications are
              partially managed by the parties contributing to the web standards
              and the browser (-engine) implementations.
            </Paragraph>
            <Paragraph>
              I believe the only way to mitigate and ideally solve security
              concerns is trust and further transparency is the origin for
              building and maintaining trustful relations. Only, if I can verify
              that communicated intentions match the actually performed actions
              and ideally all theoretical possible actions, transparency and
              thus trust can be gained. Hence open-source seems only way to
              maintain the property of transparency in the software world.
              Further, you need mechanisms that help identifying that the
              version of the remote engine that runs on your machine, matches
              the version of the source code that you or your peers reviewed.
            </Paragraph>
            <Paragraph>
              <div className="text-red-400">
                Remote runtimes will be publicly available once the transparency
                requirement is met.
              </div>
            </Paragraph>
          </Text>
        </Section>
        <Section title="Local and Remote">
          <Paragraph>
            A remote engine is a small webserver that binds to a local port and
            communicates to the outside via REST or GraphQL. Note, Local is just
            another form of being Remote, at least from the persective of this
            app. Any communication that works between different remote devices,
            works the same if both remote engines are running on the same
            physical, local device.
          </Paragraph>
          <Paragraph>
            For local deployments, I bundled the remote webserver into a native
            MacOS / Windows application that combines with a browser engine in
            parallel. So, in the same native application, you can mix flows
            using both remote and browser runtimes. Further, when you stop the
            application, you close the remote engine running on your local
            machine. In terms of trust and privacy you can be sure that no
            communication is happening via the remote services anymore. For
            situations where the remote webserver is deployed to a machine
            running in the cloud, you would instead start the small webserver
            application available as a comandline executable or docker image.
          </Paragraph>
        </Section>
      </div>
    </Template>
  );
}
