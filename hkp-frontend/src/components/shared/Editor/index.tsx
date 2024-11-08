import { CSSProperties, Component } from "react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import MonacoEditor, { loader } from "@monaco-editor/react";

import { t } from "../../../styles";

// Avoid loading monaco from CDN
// see https://github.com/suren-atoyan/monaco-react#use-monaco-editor-as-an-npm-package
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
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

export default class Editor extends Component<Props> {
  editor: any; // monaco.editor.IStandaloneCodeEditor

  state = { height: "150px" };
  render() {
    const {
      value,
      width,
      height,
      language = "json",
      style = {},
      initialWidth = 300,
      autofocus = false,
      onChange,
    } = this.props;

    const appliedStyle: CSSProperties = {
      border: "solid 1px lightgray",
      textAlign: "left",
      width: width || "100%",
      minWidth: initialWidth,
      height: height || this.state.height,
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
            this.editor = editor;
            setTimeout(() => {
              if (autofocus) {
                this.editor.focus();
              }

              this.setState({ height: "100%" });
            });
          }}
          onChange={onChange}
          language={language}
          value={value}
        />
      </div>
    );
  }

  getValue = () => this.editor && this.editor.getValue();
  setValue = (val: string) => this.editor && val && this.editor.setValue(val);
}
