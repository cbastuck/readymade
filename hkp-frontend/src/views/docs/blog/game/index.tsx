import Article from "../../../../components/layout/Article";
import Paragraph from "../../../../components/layout/Paragraph";
import Image from "../../../../components/layout/Image";

import game from "./1682265455826.gif";
import hero from "./1682312054570.png";

export default function Game() {
  return (
    <Article
      hero={hero}
      slug="game"
      title="A playful introduction to Hookup"
      date="23.4.2023"
    >
      <Paragraph headline="The Game">
        It's been a while! Time to show some ideas and concepts as a sideline to
        the exploration and engineering work.
      </Paragraph>
      <Paragraph>
        The examples section of the project contains mostly basic and a few
        advanced demos. As a starter for this first article, I picked one that
        conveys the project's main principle: seamless connection.
      </Paragraph>
      <Paragraph>
        More precisely, I hook up two devices for a game which borrows an idea
        of Pong's bouncing ball. One of the devices is used for the visual
        feedback, and the other one serves as a controller.
      </Paragraph>
      <Paragraph headline="To Setup">
        I use a laptop as the device for visual feedback and a Tablet as
        controller. Note, the game-logic runs on the laptop as well, but that's
        out of scope for today.
      </Paragraph>
      <div style={{ margin: "auto", width: "80%" }}>
        <Paragraph>1. First, I open following page on my laptop </Paragraph>
        <Paragraph>
          2. I scroll down to the bottom of the page and scan the QR code with
          my Tablet. (It leads me to the controller page in the Tablet's browser
          app)
        </Paragraph>
        <Paragraph>
          3. Both devices are now connected, as long as both stay on their pages
        </Paragraph>
        <Paragraph>
          4. On the laptop, I scroll to the middle of the screen, so I can see
          the box with the label Canvas{" "}
        </Paragraph>
        <Paragraph>
          5. On the Tablet, I focus on the box with the label XY Pad. I drag the
          round circle with my finger and notice that the bottom bar in the
          Canvas box follows the horizontal movement of my finger{" "}
        </Paragraph>
      </div>

      <Paragraph headline="Teaser">
        <Image
          src={game}
          alt="teaser video of the game"
          caption="For better quality, follow the five steps above and try it out"
        />
      </Paragraph>
      <Paragraph headline="Details and Outlook">
        Both devices are connected through a peer-to-peer connection. After an
        initial discovery phase, data flows from the controller runtime directly
        into the runtime on the laptop.
      </Paragraph>
      <Paragraph>
        When exploring or creating, I do not want to care too much about
        technicalities. Whether connecting two services (e.g. the Canvas and XY
        Pad boxes), two runtimes on the same device (a runtime is the box that
        groups services), or on different devices, should be as transparent as
        possible.{" "}
      </Paragraph>
      <Paragraph>
        In this sense, note the top runtime in the browser on the laptop. It's
        basically the same as the one in the controller. It consists of the same
        services, all using the same configuration. So, I can use that XY Pad as
        well if no remote connection is needed.
      </Paragraph>
      <Paragraph>
        In the next article, I'm going to use the same principle and move binary
        data between devices to create a slideshow experience.
      </Paragraph>
    </Article>
  );
}
