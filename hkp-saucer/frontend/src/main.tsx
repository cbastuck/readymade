import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

import "hkp-frontend/app/globals.css";
import "hkp-frontend/src/index.css";

function Main() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}
createRoot(document.getElementById("root")!).render(<Main />);
