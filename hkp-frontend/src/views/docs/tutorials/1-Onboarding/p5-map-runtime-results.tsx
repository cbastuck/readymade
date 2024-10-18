import { CircleDotDashed } from "lucide-react";

import { Note, P } from "..";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard5 } from "./boards";

export default function MapRuntimeResults() {
  return (
    <MediaParagraph
      title="Map the result from another runtime"
      video="/assets/tutorials/leavelamp-map-5.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard5 }}
    >
      In the next step, let's remove some prior simplifications and base the
      color of the lamp on an actual public transport schedule. Assume I live in
      Berlin close to Bülowstrasse and I regularily take the U2 to Pankow. To
      get the next departures in my preferred direction I need to make a call to{" "}
      <a
        href="https://v6.bvg.transport.rest/stops/900056104/departures?direction=900130002&duration=10&linesOfStops=false&remarks=true&language=en"
        target="_blank"
      >
        this
      </a>{" "}
      API and parse the output. From the result it looks like the information
      I'm searching is available via the following path:{" "}
      <code>departures[0].when</code>.
      <P>
        So, let's create a separate runtime that fetches the API and computes
        the time difference between now and the next departure in minutes.
        Later, I'll use that runtime when mapping the color of the leave lamp.
      </P>
      <P>
        The Fetcher service for this case just needs a URL which already
        contains identifiers for the departing and destination stations. This
        service can do more than just calling an API, but this will be covered
        in follow-up tutorials. Next in the video, we enter the "sensing mode"
        of the map service by clicking on the{" "}
        <CircleDotDashed className="inline" size={16} /> button. In this mode,
        the map service generates a mapping based on the data that arrives on
        the next call. Afterwards the map service leaves the sensing mode.
      </P>
      <Note>
        We could have just used a monitor at the end to inspect the result
        structure and identify the path from where to pick up the upcoming
        departure time, but I used the sensing mode to show you how it works.
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
  );
}
