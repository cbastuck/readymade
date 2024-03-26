import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "build",
  },
  plugins: [svgr(), react()],
  server: {
    port: 3333,
  },
  define: {
    // "process.env": JSON.stringify(process.env),
  },
});
