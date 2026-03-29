import React from "react";

export default function MonacoEditorMock() {
  return React.createElement("div", { "data-testid": "monaco-editor-mock" });
}

export function useMonaco() {
  return null;
}

export const loader = {
  init: () => Promise.resolve(null),
  config: () => {},
  require: () => null,
  getMonaco: () => null,
};
