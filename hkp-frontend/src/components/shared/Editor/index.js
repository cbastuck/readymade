import { Component } from "react";
import MonacoEditor from "@monaco-editor/react";

const initialHeight = "100px";

export default class Editor extends Component {
  state = { height: initialHeight };

  render() {
    const { value } = this.props;

    return (
      <div
        style={{
          border: "solid 1px lightgray",
          textAlign: "left",
          width: "100%",
          height: "100%",
        }}
      >
        <MonacoEditor
          height={this.state.height}
          onMount={(editor) => {
            this.setState({ height: "100%" });
            this.editor = editor;
          }}
          defaultLanguage="json"
          value={value}
        />
      </div>
    );
  }
  getValue = () => this.editor && this.editor.getValue();
}
