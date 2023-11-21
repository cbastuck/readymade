import { Component } from "react";
import MonacoEditor from "@monaco-editor/react";
import { t } from "../../../styles";

const initialHeight = "150px";

type Props = {
  value: string;
  width: number;
  height: number;
  language?: string;
  style?: object;
  initialWidth?: number;
  onChange: (updated: string | undefined) => void;
};
export default class Editor extends Component<Props> {
  state = { height: initialHeight };
  editor: any; // monaco.editor.IStandaloneCodeEditor

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
            height: height || "100%",
            ...t.selectable,
            ...style,
          } as any
        }
      >
        <MonacoEditor
          width="100%"
          height={this.state.height}
          onMount={(editor) => {
            setTimeout(() => this.setState({ height: "100%" }), 10);
            this.editor = editor;
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
