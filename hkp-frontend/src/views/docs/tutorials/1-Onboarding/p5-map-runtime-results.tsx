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
      In the next step, I'll remove some previous simplifications and base the
      color of the lamp on an actual public transport schedule. Assume I live in
      Berlin near Bülowstrasse and regularly take the U2 to Pankow. To get the
      upcoming departures in my preferred direction, I need to make a call to{" "}
      <a
        href="https://v6.bvg.transport.rest/stops/900056104/departures?direction=900130002&duration=10&linesOfStops=false&remarks=true&language=en"
        target="_blank"
      >
        this
      </a>{" "}
      API and parse the output. From the result, it seems the information I need
      is located at the following path: <code>departures[0].when</code>.
      <P>
        So, let's create a separate runtime that fetches data from the API and
        computes the time difference in minutes between now and the next
        departure. Later, I'll use this runtime when mapping the color of the
        leave lamp.
      </P>
      <P>
        For this purpose, the Fetcher service only requires a URL that already
        includes identifiers for the departing and destination stations. This
        service has additional capabilities beyond just calling an API, but
        these will be covered in follow-up tutorials.
      </P>
      <P>
        Next in the video, we enter the “sensing mode” of the map service by
        clicking on the <CircleDotDashed className="inline" size={16} /> button.
        In this mode, the map service generates a mapping based on the data
        received on the next call. The map service then exits sensing mode
        automatically.
      </P>
      <Note>
        I could have simply used a Monitor service at the end to inspect the
        result structure and identify the path to the upcoming departure time,
        but I chose to use sensing mode to demonstrate how it works.
      </Note>
      <P>
        Once we have the departure time, let's use the exposed{" "}
        <a href="https://momentjs.com" target="_blank">
          <code>MomentJS</code>
        </a>{" "}
        APIs to compute the difference between the next departure and the
        current time in minutes using an additional map service
      </P>
    </MediaParagraph>
  );
}
