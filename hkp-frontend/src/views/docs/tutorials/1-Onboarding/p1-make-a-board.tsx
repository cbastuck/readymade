import MediaParagraph from "../MediaParagraph";

export default function MakeABoard() {
  return (
    <MediaParagraph
      title="How to make a Board"
      video="/assets/tutorials/leavelamp-map-1.mp4"
    >
      Let's create a new board and add a browser runtime with three services
      inside: Injector, Map, and Monitor. This video demonstrates how to set up
      each step.
    </MediaParagraph>
  );
}
