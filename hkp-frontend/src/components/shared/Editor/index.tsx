import { Component } from "react";
import MonacoEditor from "@monaco-editor/react";
import { t } from "../../../styles";

type Props = {
  value: string;
  width?: number;
  height?: number;
  language?: string;
  style?: object;
  initialWidth?: number;
  onChange: (updated: string | undefined) => void;
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
      onChange,
    } = this.props;

    return (
      <div
        style={
          {
            border: "solid 1px lightgray",
            textAlign: "left",
            width: width || "100%",
            minWidth: initialWidth,
            height: height || this.state.height,
            ...t.selectable,
            ...style,
          } as any
        }
      >
        <MonacoEditor
          onMount={(editor) => {
            this.editor = editor;
            setTimeout(() => this.setState({ height: "100%" }));
          }}
          onChange={onChange}
          defaultLanguage={language}
          value={value}
        />
      </div>
    );
  }

  getValue = () => this.editor && this.editor.getValue();
}
