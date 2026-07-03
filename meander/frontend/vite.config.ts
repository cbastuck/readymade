import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

import { readBuildVersion } from "./buildVersion";

const hkpFrontendRoot = path.resolve(import.meta.dirname, "../../hkp-frontend");

export default defineConfig({
  define: {
    __READYMADE_BUILD_VERSION__: JSON.stringify(
      readBuildVersion(import.meta.dirname),
    ),
  },
  server: {
    host: "0.0.0.0", // added only for using the frontend in Meander iOS app - remove if not needed
    fs: {
      allow: [".", hkpFrontendRoot],
    },
  },
  plugins: [svgr(), react()],
  resolve: {
    // hkp-frontend has its own node_modules; without deduping, its files pull in
    // a second copy of React (and react-router-dom), which breaks hooks with
    // "Invalid hook call". Force a single copy across the merged source tree.
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    alias: {
      fs: path.resolve(import.meta.dirname, "src/shims/fs.ts"),
      // meander/frontend imports from the sibling hkp-frontend package.
      // Map monorepo-style paths back to the local checkout.
      "hkp-frontend/src": path.join(hkpFrontendRoot, "src"),
      "hkp-frontend/app": path.join(hkpFrontendRoot, "app"),
    },
  },
});
