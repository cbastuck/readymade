import { useRef, useState } from "react";
import ProgressIndicator from "../../components/ProgressIndicator";

import SandboxFrame from "../../components/SandboxFrame";

import NavigateButton from "../NavigateButton";

export default function PitchPage() {
  const progressRef = useRef<ProgressIndicator>(null);
  const [introFinished, setIntroFinished] = useState(false);
  return (
    <div style={{ height: "100%", width: "50%", margin: "auto" }}>
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
            setTimeout(() => setIntroFinished(true), 500);
          } else if (checkpoint) {
            progressRef.current?.triggerAnimation();
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
            destination="/welcome/experiment"
            text="A thought experiment"
          />
        </div>
      )}
    </div>
  );
}
