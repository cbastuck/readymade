import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

import { readBuildVersion } from "./buildVersion";

const rootDir = import.meta.dirname;
const hkpFrontendRoot = path.resolve(rootDir, "../../hkp-frontend");
const androidWebAppDir = path.resolve(
  rootDir,
  "../../meander-android/app/src/main/assets/WebApp",
);

export default defineConfig({
  define: {
    __READYMADE_BUILD_VERSION__: JSON.stringify(readBuildVersion(rootDir)),
  },
  plugins: [svgr(), react()],
  build: {
    outDir: androidWebAppDir,
    emptyOutDir: true,
  },
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    alias: {
      fs: path.resolve(rootDir, "src/shims/fs.ts"),
      "hkp-frontend/src": path.join(hkpFrontendRoot, "src"),
      "hkp-frontend/app": path.join(hkpFrontendRoot, "app"),
    },
  },
});
