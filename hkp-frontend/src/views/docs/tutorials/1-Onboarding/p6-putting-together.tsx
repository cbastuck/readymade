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
      Let's bring both runtimes onto the same board. First, we have the runtime
      that maps the light color based on the time left until the next departure,
      and second, the runtime that fetches the upcoming departures and
      calculates the time difference in minutes. Additionally, let’s add a
      second condition in which the lamp turns red: this will occur when the
      next departure is more than five minutes away. I'll also include some
      contextual information, enabling me to debug the lamp color based on the
      received data. This debug information can be displayed by changing the map
      service mode in the first runtime from 'replace' to 'add'.
      <P>
        Under normal circumstances, the output from the first runtime would feed
        into the second runtime. However, since I'm invoking the second runtime
        within the map service of the first runtime, I'll use the output options
        of the first runtime to halt further processing.
      </P>
    </MediaParagraph>
  );
}
