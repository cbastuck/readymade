import { Link } from "react-router-dom";

import Template from "hkp-frontend/src/views/Template";
import Sketch from "../../Sketch";
import { P } from "..";
import MakeABoard from "./p1-make-a-board";
import RenameSaveBoard from "./p2-rename-save-board";
import HowItWorks from "./p3-how-it-works";

import DynamicMapping from "./p4-dynamic-mapping";
import MapRuntimeResults from "./p5-map-runtime-results";
import PuttingTogether from "./p6-putting-together";
import NextSteps from "./p8-next-steps";
import ArrayObjectMapping from "./p7-array-object-mapping";

export default function StarterTutorial() {
  return (
    <Template title="On-Boarding - Leave Lamp" parent="Tutorials">
      <div className="flex flex-col h-full gap-4 text-base tracking-wider leading-6">
        <h2 className="mt-6">The Board's Structure</h2>
        <div>
          <P>
            First, make sure to check out the{" "}
            <Link to="/docs/quickstart">Quickstarter</Link> page, particularly
            the following image:
          </P>
          <div className="w-[80%] mx-auto py-2">
            <Sketch />
          </div>
          <P>
            This graphic shows the basic structure of a board, which includes
            the runtimes and, within each runtime, a sequence of services. Data
            flows from left to right, with each runtime passing incoming data
            sequentially to its hosted services. Each service can read and
            modify the incoming data, and may choose to stop the chain based on
            what it receives. Once a runtime completes its sequence, it passes
            the data to the next runtime, unless configured otherwise.
          </P>
          <P>
            An important point to remember is that if you're using the web
            version of Hookitapp, the board is managed by the browser. Closing
            the browser or tab will stop and destroy all runtimes and the
            services they host.
          </P>
          <P>
            Hookitapp also has a standalone version, which runs as a native
            application on Mac, Windows and Linux. The Playground view in this
            version is nearly identical to the web version, but it offers many
            additional benefits that will be covered in upcoming tutorials.
          </P>
          <P>
            It's also worth noting that not all runtimes are browser-based; you
            can mix remote and browser runtimes on the same board. Browser
            runtimes are limited to resources accessible within the browser's
            sandbox, while remote runtimes can access more resources and can run
            locally, on other devices within the network, or in the cloud.
            Passing data between browser and remote runtimes is handled
            seamlessly, so no additional configuration is required.
          </P>
        </div>
        <h2 className="mt-6">The Project</h2>
        <P>
          For this starter tutorial, I'll use a relatable example to make the
          introduction more interesting and realistic. The idea is to create a
          lamp that shows a green light when it's a good time to leave the house
          and a red light when it's not. Whether it's a good or bad time depends
          on the schedule of the bus or U-Bahn I usually take. I prefer to keep
          things in flow, so I'd like to avoid arriving just a bit too late and
          then waiting a full cycle. Leaving about three minutes before the next
          ride typically gives me enough time to arrive on schedule.
        </P>
        <P>
          To keep things simple and to showcase some basic services, I'll
          simplify the setup a lot. The goal is to create an initial
          understanding of how Hookitapp works.
        </P>
        <h2 className="mt-6">The Map Service</h2>
        The following paragraphs will introduce the map service and demonstrate
        how it can be used to implement the leave lamp.
        <MakeABoard />
        <RenameSaveBoard />
        <HowItWorks />
        <DynamicMapping />
        <MapRuntimeResults />
        <PuttingTogether />
        <ArrayObjectMapping />
        <NextSteps />
      </div>
    </Template>
  );
}
