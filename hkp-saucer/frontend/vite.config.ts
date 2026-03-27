import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const hkpFrontendRoot = path.resolve(import.meta.dirname, "../../hkp-frontend");

export default defineConfig({
  plugins: [svgr(), react()],
  resolve: {
    alias: {
      // hkp-saucer/frontend imports from the sibling hkp-frontend package.
      // Map monorepo-style paths back to the local checkout.
      "hkp-frontend/src": path.join(hkpFrontendRoot, "src"),
      "hkp-frontend/app": path.join(hkpFrontendRoot, "app"),
    },
  },
});
