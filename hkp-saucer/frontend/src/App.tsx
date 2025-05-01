import { App as HkpApp, Playground } from "hkp-frontend";

import "hkp-frontend/build-lib/style.css";
import { useEffect, useState } from "react";

async function onInit(setter: (remotes: any) => void) {
  setter(await window.saucer.exposed.getRemotes());
}

function App() {
  const [remotes, setRemotes] = useState<any>(null);
  useEffect(() => {
    onInit(setRemotes);
  }, []);

  console.log("App remotes", remotes);

  return (
    <HkpApp>
      <Playground boardName="Saucer" />
    </HkpApp>
  );
}

export default App;
