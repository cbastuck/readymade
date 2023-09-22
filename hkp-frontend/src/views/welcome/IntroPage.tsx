import { useRef } from "react";
import ProgressIndicator from "../../components/ProgressIndicator";

import SandboxFrame from "../../components/SandboxFrame";

import NavigateButton from "../NavigateButton";

type Props = {
  introFinished: boolean;
  onIntroFinished: () => void;
  onNext: () => void;
};

export default function IntroPage({
  introFinished,
  onIntroFinished,
  onNext,
}: Props) {
  const progressRef = useRef<ProgressIndicator>(null);
  return (
    <div style={{ height: "100%" }}>
      <SandboxFrame
        title="Hookup Intro"
        src="/boards/introduction.json"
        frameless={true}
        frameBorder={0}
        height="84%"
        width="100%"
        maxWidth={800}
        onAction={({ checkpoint }) => {
          if (checkpoint === "@last-slide") {
            setTimeout(onIntroFinished, 500);
          } else if (checkpoint) {
            progressRef.current && progressRef.current.triggerAnimation();
          }
        }}
      />
      <ProgressIndicator
        durationInSec={7}
        ref={progressRef}
        visible={!introFinished}
      />
      {introFinished && (
        <div>
          <NavigateButton
            destination="/?page=visualisation"
            text="A thought experiment"
            onClicked={onNext}
          />
        </div>
      )}
    </div>
  );
}
