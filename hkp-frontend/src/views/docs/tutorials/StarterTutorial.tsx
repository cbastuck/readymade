import { Link } from "react-router-dom";
import { FunctionSquare, Equal, CircleDotDashed } from "lucide-react";
import Template from "@/views/Template";
import Sketch from "../Sketch";
import MediaParagraph from "./MediaParagraph";
import Shortcut from "@/ui-components/Shortcut";
import Plug from "@/assets/plug.svg?react";
import ArrayPlug from "@/assets/plugArray.svg?react";

import {
  leaveLampBoard2,
  leaveLampBoard3,
  leaveLampBoard4,
  leaveLampBoard5,
  leaveLampBoard6,
  leaveLampBoard7,
} from "./boards";
import { useTheme } from "@/ui-components/ThemeContext";

export default function StarterTutorial() {
  const theme = useTheme();
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

        <MediaParagraph
          title="How to make a Board"
          video="/assets/tutorials/leavelamp-map-1.mp4"
        >
          Let's create a new board, add a browser runtime, and inside three
          services: Injector, Map, and Monitor. This video shows how to do that.
        </MediaParagraph>

        <MediaParagraph
          title="How to rename and save a Board"
          video="/assets/tutorials/leavelamp-map-2.mp4"
          board={{ name: "LeaveLamp", src: leaveLampBoard2 }}
        >
          When creating a new board as shown above, the created board gets a
          random name. This name serves as a placeholder until you feel like
          assigning a meaningful name. Further, the state of a board is not
          automatically saved. You need to save by using the board menu or the
          keyboard shortcut <Shortcut type="command" char="s" />. Let's do this
          and reload the page afterwards to verify it worked.
        </MediaParagraph>

        <MediaParagraph
          title="How it works"
          video="/assets/tutorials/leavelamp-map-3.mp4"
          board={{ name: "LeaveLamp", src: leaveLampBoard3 }}
        >
          I use the Injector service for having a button to start the flow.
          Certainly, a Leave Lamp would not require an explicit trigger, so this
          is to get started. Injectors are services to start a flow and can pump
          many data types into the flow; let's use an empty JSON object as a
          trigger.
          <P>
            The map service transforms incoming data, preferably JSON data.
            There are two different modes: static or dynamic mapping. In a
            static mapping the result data, does not the depend on the input or
            derived context data. The video shows a static mapping. The result
            of this would be a constant green light.
          </P>
        </MediaParagraph>

        <MediaParagraph
          title="Dynamic Mapping"
          video="/assets/tutorials/leavelamp-map-4.mp4"
          board={{ name: "LeaveLamp", src: leaveLampBoard4 }}
        >
          In a dynamic mapping the input data serves as a parameter to a
          Javascript function that is dynamically evaluated based on the input
          data and the context. The key of a dynamic mapping always ends with a{" "}
          <Equal className="inline" size={16} /> sign. For switching between
          static and dynamic mode, you can also use the{" "}
          <FunctionSquare className="inline" size={16} /> button.
          <P>
            With that in mind, let's simplify the solution and assume a ride
            leaves every ten minutes. Further, the first ride starts at the full
            hour and continues on a constant schedule day and night. In this
            case a dynamic mapping computes the time between the current minute
            and the next interval, via division by ten and taking the reminder.
            If the remainder is less than three minutes, I won't make it in time
            and the light should be red.
          </P>
        </MediaParagraph>

        <MediaParagraph
          title="Map the result from another runtime"
          video="/assets/tutorials/leavelamp-map-5.mp4"
          board={{ name: "LeaveLamp", src: leaveLampBoard5 }}
        >
          In the next step, let's remove some prior simplifications and base the
          color of the lamp on an actual public transport schedule. Assume I
          live in Berlin close to Bülowstrasse and I regularily take the U2 to
          Pankow. To get the next departures in my preferred direction I need to
          make a call to{" "}
          <a
            href="https://v6.bvg.transport.rest/stops/900056104/departures?direction=900130002&duration=10&linesOfStops=false&remarks=true&language=en"
            target="_blank"
          >
            this
          </a>{" "}
          API and parse the output. From the result it looks like the
          information I'm searching is available via the following path:{" "}
          <code>departures[0].when</code>.
          <P>
            So, let's create a separate runtime that fetches the API and
            computes the time difference between now and the next departure in
            minutes. Later, I'll use that runtime when mapping the color of the
            leave lamp.
          </P>
          <P>
            The Fetcher service for this case just needs a URL which already
            contains identifiers for the departing and destination stations.
            This service can do more than just calling an API, but this will be
            covered in follow-up tutorials. Next in the video, we enter the
            "sensing mode" of the map service by clicking on the{" "}
            <CircleDotDashed className="inline" size={16} /> button. In this
            mode, the map service generates a mapping based on the data that
            arrives on the next call. Afterwards the map service leaves the
            sensing mode.
          </P>
          <Note>
            We could have just used a monitor at the end to inspect the result
            structure and identify the path from where to pick up the upcoming
            departure time, but I used the sensing mode to show you how it
            works.
          </Note>
          <P>
            Once we have the departure time, let's use the{" "}
            <a href="https://momentjs.com" target="_blank">
              <code>MomentJS</code>
            </a>{" "}
            APIs to compute the difference between the next departure and the
            current time in minutes using an additional map service
          </P>
        </MediaParagraph>

        <MediaParagraph
          title="Putting it together"
          video="/assets/tutorials/leavelamp-map-6.mp4"
          board={{ name: "LeaveLamp", src: leaveLampBoard6 }}
        >
          Let's bring both runtimes into the sames board, first the runtime that
          maps the light color based on the time left until the next departure
          and second the runtime that actually fetches the next departures and
          computes the time difference in minutes. Also, let's add a second
          condition in which case the lamp turns red, which is when the next
          departure is more than five minutes away from now. Further, I'll add
          some context information, so I'm able to debug the lamp color based on
          the received data. The debug information can be made visible by
          changing the mode of the map service in the first runtime from
          'replace' to 'add'.
          <P>
            Normally the result of the first runtime would flow into the second
            runtime. Since I invoke the second runtime in the map service of the
            first runtime, I use the first runtime's output options to stop
            further processing.
          </P>
        </MediaParagraph>

        <MediaParagraph
          title="Array and Object Mapping"
          video="/assets/tutorials/leavelamp-map-7.mp4"
          board={{ name: "LeaveLamp", src: leaveLampBoard7 }}
        >
          Let's remove another simplification which makes the leave lamp mostyl
          unusable at the moment: I only consider the upcoming departure,
          although there might be multiple upcoming departures in the fetched
          time window. So, if the next departure would leave in one minute, the
          lamp would show a red light, even if another departure would leave in
          four minutes. Let's fix this by mapping the whole array of departures
          instead of just the first one. The map service can handle both arrays
          and objects. If the input is an array, the map service will iterate
          over each element and apply the mapping to each element. If the input
          is an object, the map service will apply the mapping to the object
          itself. By introducing a new map service that takes the array of
          departures from the resulting json structure and puts this into the
          following services, the runtime generates a multiple time diffs,
          including debug information for each upcoming departure.
          <P>
            By using just <code>=</code> as mapping key, the service can replace
            the whole input (<code>params</code>) by the mapped value without
            wrapping it into an object.
            <P>
              For example: <code>=</code> as key and{" "}
              <code>params.departures</code> as value, will replace the whole
              input by the departures array. In contrast <code>x=</code> as key
              and <code>params.departures</code> as value, will create on object
              with a property x, and this contains the departures array.
            </P>
          </P>
          <Note>
            Whether a service outputs scaler data type, or an array, is
            visualised at the output of a service. The single{" "}
            <Plug
              className="inline"
              width="15px"
              stroke={theme.accentColor}
              fill={theme.accentColor}
            />{" "}
            symbol indicates a scalar output. The double{" "}
            <ArrayPlug
              className="inline"
              width="20px"
              fill={theme.accentColor}
            />{" "}
            symbol indicates an array output.
          </Note>
        </MediaParagraph>
        <P title="Next steps">
          So far, in this tutorial I mostly touched on the map service. The
          leave lamp as far from being ready. Even if it is more a thought model
          at some point making a real leave lamp, could become a small step. So,
          I will pick up this project in follow-up tutorials that look into
          other services in more detail.
        </P>
      </div>
    </Template>
  );
}

function P({ children, className, title }: any) {
  return (
    <div className={`py-2 ${className}`}>
      {title && <h3 className="my-2 p-0">{title}</h3>}
      {children}
    </div>
  );
}

function Note({ children }: any) {
  return <P className="bg-gray-100 p-4 rounded my-2">{children}</P>;
}
