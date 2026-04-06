import {
  CSSProperties,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";

import MonacoEditor, { loader } from "@monaco-editor/react";

import { t } from "../../../styles";

// Avoid loading monaco from CDN
// see https://github.com/suren-atoyan/monaco-react#use-monaco-editor-as-an-npm-package
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};
loader.config({ monaco });

type Props = {
  value: string;
  width?: number;
  height?: number;
  language?: string;
  style?: object;
  initialWidth?: number;
  autofocus?: boolean;
  onChange?: (updated: string | undefined) => void;
};

export type EditorHandle = {
  getValue: () => any;
  setValue: (val: string) => void;
  /** Returns the currently selected text, or null if nothing is selected. */
  getSelectionText: () => string | null;
  /** Replaces the current selection with the given text. */
  replaceSelection: (text: string) => void;
};

const Editor = forwardRef<EditorHandle, Props>(function Editor(
  {
    value,
    width,
    height,
    language = "json",
    style = {},
    initialWidth = 300,
    autofocus = false,
    onChange,
  }: Props,
  ref,
) {
  const editorRef = useRef<any>(null);
  const [editorHeight, setEditorHeight] = useState("150px");

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current && editorRef.current.getValue(),
    setValue: (val: string) =>
      editorRef.current && val !== undefined && editorRef.current.setValue(val),
    getSelectionText: () => {
      const editor = editorRef.current;
      if (!editor) return null;
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return null;
      return editor.getModel()?.getValueInRange(selection) ?? null;
    },
    replaceSelection: (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      if (!selection) return;
      editor.executeEdits("replaceSelection", [
        { range: selection, text },
      ]);
      editor.focus();
    },
  }));

  const appliedStyle: CSSProperties = {
    border: "solid 1px lightgray",
    textAlign: "left",
    width: width || "100%",
    minWidth: initialWidth,
    height: height || editorHeight,
    ...t.selectable,
    ...style,
  };

  return (
    <div style={appliedStyle}>
      <MonacoEditor
        onMount={(editor) => {
          if (editor) {
            editor.updateOptions({
              wordWrap: "on",
              autoClosingBrackets: "never",
            }); // TODO: provide an option
          }
          editorRef.current = editor;
          setTimeout(() => {
            if (autofocus) {
              editorRef.current.focus();
            }

            setEditorHeight("100%");
          });
        }}
        onChange={onChange}
        language={language}
        value={value}
      />
    </div>
  );
});

export default Editor;
