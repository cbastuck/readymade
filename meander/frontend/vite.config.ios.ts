import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const rootDir = import.meta.dirname;
const hkpFrontendRoot = path.resolve(rootDir, "../../hkp-frontend");
const iosWebAppDir = path.resolve(
  rootDir,
  "../../meander-ios/MeanderIOS/Resources/WebApp",
);

export default defineConfig({
  plugins: [svgr(), react()],
  build: {
    outDir: iosWebAppDir,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      fs: path.resolve(rootDir, "src/shims/fs.ts"),
      "hkp-frontend/src": path.join(hkpFrontendRoot, "src"),
      "hkp-frontend/app": path.join(hkpFrontendRoot, "app"),
    },
  },
});
