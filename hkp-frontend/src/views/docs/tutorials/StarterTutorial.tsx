import Template from "@/views/Template";
import Sketch from "../Sketch";
import { Link } from "react-router-dom";
import Video from "@/components/layout/Video";

import Shortcut from "@/ui-components/Shortcut";
import { FunctionSquare } from "lucide-react";

export default function StarterTutorial() {
  return (
    <Template title="Lesson 1" parent="Tutorials">
      <div className="flex flex-col h-full gap-4 text-base tracking-wider leading-6">
        <h2 className="mt-6">Basic structure</h2>
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
            it received. Once the end of a runtime is reached, the data is
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
            upcoming lessons.
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
        <h2 className="mt-6">The Project: Leave Lamp</h2>
        <P>
          For the following starter tutorial, I'll pick an example to make the
          introduction more interesting and realistic. The idea is to have a
          lamp that shows a green light when it's a good time to leave the house
          or red when it's a bad time. Whether the time is good or bad depends
          on the schedule of the bus or UBahn that I usually take. I like it
          when things are in flow, so want to avoid situations when I arrive at
          the station a bit too late and I have to wait for the next ride.
          Leaving three minutes before the next ride is usually good enough to
          arrive on time.
        </P>
        <P>
          I'll artificially simplify the problem to show some basic services in
          action. The goal is to create an initial understanding of things work
          when using Hookitapp.
        </P>
        <h2 className="mt-6">The Map Service</h2>

        <P>
          Let's create a new board, add a browser runtime, and inside three
          services: Injector, Map, and Monitor. The following video shows how to
          do that:
          <Video src="/assets/tutorials/leavelamp-map-1.mp4" />
        </P>

        <P>
          When creating a new board as shown in the video, the created board
          gets a random name. This name serves as a placeholder until you feel
          like giving it a meaningful name. Further, the state of a board is not
          automatically saved. You explictly need to save by using the board
          menu or the keyboard shortcut <Shortcut type="command" char="s" />.
          Let's do this and reload the page afterwards to verify it worked.
          <Video src="/assets/tutorials/leavelamp-map-2.mp4" />
        </P>

        <P>
          Simply, I use the Injector service for having a button to start the
          flow. Certainly, a Leave Lamp would not require an explicit trigger,
          so this is to get started. Injectors are services to start a flow and
          can pump differnet data types into the flow; let's use an empty JSON
          object as a trigger.
        </P>
        <P>
          The map service transforms incoming data, preferably JSON data. There
          are two different modes: static or dynamic mapping. In a static
          mapping the result data, does not the depend on the input or derived
          context data. The following video shows a static mapping, which would
          produce a constant green light on the output.
          <Video src="/assets/tutorials/leavelamp-map-3.mp4" />
        </P>

        <P>
          In a dynamic mapping the input data serves as a parameter to a
          Javascript function that is dynamically evaluated based on the input
          data and the context. The key of a dynamic mapping always ends with a
          <code className="inline"> = </code> sign, which can also be toggled
          using the <FunctionSquare className="inline" size={16} /> button.
          Let's simplify and assume a ride leaves every ten minutes, starting at
          the full hour, throughout day and night. In this case a dynamic
          mapping computes the time between the current minute and the next
          interval, via division by ten and taking the reminder. If the time is
          less than three minutes, I won't make it in time and the output
          produces a red light.
          <Video src="/assets/tutorials/leavelamp-map-4.mp4" />
        </P>
        <P>
          {/*
          curl -X 'GET' \
          'https://v6.bvg.transport.rest/stops/900056104/departures?direction=900025202&duration=10&linesOfStops=false&remarks=true&language=en'
          \ -H 'accept: application/json' curl -X 'GET'
          'https://v6.bvg.transport.rest/stops/900056104/departures?direction=900025202&duration=10&linesOfStops=false&remarks=true&language=en'
          -H 'accept: application/json'
        */}
        </P>
      </div>
    </Template>
  );
}

function P({ children, className }: any) {
  return <div className={`py-2 ${className}`}>{children}</div>;
}
