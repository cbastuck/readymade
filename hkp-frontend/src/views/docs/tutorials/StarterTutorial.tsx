import Template from "@/views/Template";
import Sketch from "../Sketch";
import { Link } from "react-router-dom";

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
        <h2 className="mt-6">Services: Map and Monitor</h2>
        <P>
          Let's start with three services, one core service "Map" and two
          services that mostly are used for debgging and testing: "Injector" and
          "Monitor". Injectors can help in the beginning as an entry point to
          pass data into the chain. Monitors are mainly for debugging to display
          the data that flows through.
        </P>
        <h3>1. Setup a first chain</h3>
      </div>
    </Template>
  );
}

function P({ children }: any) {
  return <div className="py-2">{children}</div>;
}
