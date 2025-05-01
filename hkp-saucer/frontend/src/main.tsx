import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    saucer: any;
    webapp: {
      onStartup: (a: any) => void;
    };
  }
}

window.webapp = {
  onStartup: (a) => {
    console.log("Webapp started", a);
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
