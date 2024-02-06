import { Component } from "react";
import { TextArea } from "semantic-ui-react";

import Resizable from "./Resizable";
import Editor from "./shared/Editor/index";
import { filterPrivateMembers } from "../runtime/browser/services/helpers";
import { s, t } from "../styles";
import Button from "./shared/Button";
import { detectBrowserIOS } from "../runtime/browser/services/helpers";

export default class ConfigurationEditor extends Component {
  renderConfigAsTextArea = (filteredService) => {
    const textAreaData = this.state && this.state.textAreaData;
    if (!textAreaData) {
      this.setState({ textAreaData: JSON.stringify(filteredService, null, 2) });
      return;
    }
    return (
      <TextArea
        style={s(t.fill, { resize: "none", border: "none" })}
        value={textAreaData}
        onChange={(_, { value: textAreaData }) =>
          this.setState({ textAreaData })
        }
      />
    );
  };

  render() {
    const { service, onClose, onChange } = this.props;
    const { uuid, board, ...filteredService } = filterPrivateMembers(service);
    const buttonStyle = s(t.fs12, t.ls1, { flexGrow: 1 });
    const useEditor = !detectBrowserIOS();
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        <Resizable>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1 style={s(t.fs13, t.ls1)}>Service Configuration</h1>
            <div
              style={{
                height: "100%",
                minWidth: "600px",
                margin: 5,
                flexGrow: 1,
              }}
            >
              {useEditor ? (
                <Editor
                  ref={(editor) => (this.editor = editor)}
                  value={JSON.stringify(filteredService, null, 2)}
                  language="json"
                />
              ) : (
                this.renderConfigAsTextArea(filteredService)
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                margin: 10,
              }}
            >
              <Button style={buttonStyle} onClick={onClose}>
                Close
              </Button>
              <Button
                style={buttonStyle}
                onClick={() =>
                  onChange(
                    this.editor
                      ? this.editor.getValue()
                      : this.state.textAreaData
                  )
                }
              >
                Update
              </Button>
            </div>
          </div>
        </Resizable>
      </div>
    );
  }
}
