import { CSSProperties, Component } from "react";
import MonacoEditor from "@monaco-editor/react";
import { t } from "../../../styles";

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
