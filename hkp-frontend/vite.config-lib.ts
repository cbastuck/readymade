import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
//import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["react", "react-dom", "react-router-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    outDir: "build-lib",
    copyPublicDir: false,
    lib: {
      entry: path.resolve(__dirname, "lib/main.ts"),
      formats: ["es"],
    },
  },
  plugins: [svgr(), react() /*, dts({ include: ["lib", "src"] })*/], // disable types as they seem to have a wrong root
  server: {
    port: 3000,
  },
  define: {
    // "process.env": JSON.stringify(process.env),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
