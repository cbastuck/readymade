import { useState } from "react";

import Engage from "../engage/Engage";
import WelcomeTemplate from "./WelcomeTemplate";
import WelcomePanel from "./WelcomePanel";

export default function WelcomePage() {
  const [engageVisible, setEngageVisible] = useState(false);
  return (
    <WelcomeTemplate height={engageVisible ? "100%" : undefined}>
      {engageVisible ? (
        <div style={{ height: "100%", overflow: "auto" }}>
          <Engage withTemplate={false} />
        </div>
      ) : (
        <WelcomePanel onEngage={() => setEngageVisible(true)} />
      )}
    </WelcomeTemplate>
  );
}
