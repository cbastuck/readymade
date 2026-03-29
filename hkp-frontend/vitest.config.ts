import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [svgr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "hkp-frontend/src": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setupTests.ts",
    alias: {
      streamsaver: path.resolve(__dirname, "./src/test/mocks/streamsaver.ts"),
      jstat: path.resolve(__dirname, "./src/test/mocks/jstat.ts"),
      "@monaco-editor/react": path.resolve(
        __dirname,
        "./src/test/mocks/monaco-react.tsx",
      ),
    },
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["build/**", "node_modules/**"],
    restoreMocks: true,
    clearMocks: true,
  },
});
