import { P } from "..";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard6 } from "./boards";

export default function PuttingTogether() {
  return (
    <MediaParagraph
      title="Putting it together"
      video="/assets/tutorials/leavelamp-map-6.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard6 }}
    >
      Let's bring both runtimes into the sames board, first the runtime that
      maps the light color based on the time left until the next departure and
      second the runtime that actually fetches the next departures and computes
      the time difference in minutes. Also, let's add a second condition in
      which case the lamp turns red, which is when the next departure is more
      than five minutes away from now. Further, I'll add some context
      information, so I'm able to debug the lamp color based on the received
      data. The debug information can be made visible by changing the mode of
      the map service in the first runtime from 'replace' to 'add'.
      <P>
        Normally the result of the first runtime would flow into the second
        runtime. Since I invoke the second runtime in the map service of the
        first runtime, I use the first runtime's output options to stop further
        processing.
      </P>
    </MediaParagraph>
  );
}
