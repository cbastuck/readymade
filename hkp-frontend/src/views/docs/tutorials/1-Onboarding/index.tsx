import { Link } from "react-router-dom";

import Template from "@/views/Template";
import Sketch from "../../Sketch";
import { P } from "..";
import MakeABoard from "./p1-make-a-board";
import RenameSaveBoard from "./p2-rename-save-board";
import HowItWorks from "./p3-how-it-works";

import DynamicMapping from "./p4-dynamic-mapping";
import MapRuntimeResults from "./p5-map-runtime-results";
import PuttingTogether from "./p6-putting-together";
import NextSteps from "./p8-next-steps";

export default function StarterTutorial() {
  return (
    <Template title="On-Boarding - Leave Lamp" parent="Tutorials">
      <div className="flex flex-col h-full gap-4 text-base tracking-wider leading-6">
        <h2 className="mt-6">The Board's Structure</h2>
        <div>
          <P>
            First, make sure you've had a look at the{" "}
            <Link to="/docs/quickstart">Quickstarter</Link> page, especially at
            the following image:
          </P>
          <div className="w-[80%] mx-auto py-2">
            <Sketch />
          </div>
          <P>
            It shows the basic structure of a board, i.e., the runtimes, and
            inside the runtimes, a sequence of services. Data flows from left to
            right. A runtime passes incoming data sequentially to each of its
            hosted services. Every service can read and modify the incoming
            data. A service can also decide to stop the chain based on the data
            it receives. Once the end of a runtime is reached, the data is
            passed to the next runtime, unless configured otherwise.
          </P>
          <P>
            The important thing to keep in mind is that if you use the web
            version of Hookitapp, the board is managed by the browser.
            Therefore, by closing the browser (or tab), you stop and destroy all
            runtimes, including the services they host.
          </P>
          <P>
            Besides the web version, there is a standalone version of Hookitapp,
            which runs as a native application on Mac and Windows. The
            Playground view of this version appears almost exactly like the web
            version, but it offers many benefits that will be covered in
            upcoming tutorials.
          </P>
          <P>
            What you should remember, though, is that not all runtimes are
            browser runtimes. You can mix remote and browser runtimes on the
            same board. While browser runtimes can only access resources
            available through the sandbox of the browser, remote runtimes can do
            more, and run on the same machine, on different machines in your
            local network, or in the cloud. Passing outgoing data from a browser
            runtime to a remote runtime and vice versa is handled transparently.
            You don't need to do anything for that to work.
          </P>
        </div>
        <h2 className="mt-6">The Project</h2>
        <P>
          For the following starter tutorial, I'll pick an example to make the
          introduction more interesting and realistic. The idea is to have a
          lamp that shows a green light when it's a good time to leave the house
          or red when it's a bad time. Whether the time is good or bad depends
          on the schedule of the bus or UBahn I usually take. I like it when
          things are in flow, so I want to avoid situations when I arrive at the
          station a bit too late and I have to wait a full cycle. Leaving three
          minutes before the next ride is usually good enough to arrive on time.
        </P>
        <P>
          I'll artificially simplify the problem to show some basic services in
          action. The goal is to create an initial understanding of how things
          work with Hookitapp.
        </P>
        <h2 className="mt-6">The Map Service</h2>
        The following paragraphs will dive a bit deeper into the map service and
        how it could be used to realise the leave lamp.
        <MakeABoard />
        <RenameSaveBoard />
        <HowItWorks />
        <DynamicMapping />
        <MapRuntimeResults />
        <PuttingTogether />
        <NextSteps />
      </div>
    </Template>
  );
}
