import { Component } from "react";
import MonacoEditor from "@monaco-editor/react";
import { t } from "../../../styles";

const initialHeight = "150px";

export default class Editor extends Component {
  state = { height: initialHeight };

  render() {
    const {
      value,
      onChange,
      width,
      height,
      language = "json",
      style = {},
      initialWidth = 300,
    } = this.props;

    return (
      <div
        style={{
          border: "solid 1px lightgray",
          textAlign: "left",
          width: width || "100%",
          minWidth: initialWidth,
          height: height || "100%",
          ...t.selectable,
          ...style,
        }}
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
