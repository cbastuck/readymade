import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const rootDir = import.meta.dirname;
const hkpFrontendRoot = path.resolve(rootDir, "../../hkp-frontend");
const iosWebAppDir = path.resolve(
  rootDir,
  "../../meander-ios/ReadymadeIOS/Resources/WebApp",
);

export default defineConfig({
  plugins: [svgr(), react()],
  build: {
    outDir: iosWebAppDir,
    emptyOutDir: true,
  },
  resolve: {
    // hkp-frontend has its own node_modules; without deduping, its files pull in
    // a second copy of React (and react-router-dom), which breaks hooks with
    // "Invalid hook call". Force a single copy across the merged source tree.
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    alias: {
      fs: path.resolve(rootDir, "src/shims/fs.ts"),
      "hkp-frontend/src": path.join(hkpFrontendRoot, "src"),
      "hkp-frontend/app": path.join(hkpFrontendRoot, "app"),
    },
  },
});
