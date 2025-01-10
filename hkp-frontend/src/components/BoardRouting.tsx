import { Component } from "react";

import { s, t } from "../styles";
import InputField from "./shared/InputField";

type Routing = {
  inputUrl?: string;
  inputTopic?: string;
  outputUrl?: string;
  outputTopic?: string;
};

type Props = {
  routing: Routing;
  onChange: (routing: Routing) => void;
};

type State = Routing;

export default class BoardRouting extends Component<Props, State> {
  state = {
    inputUrl: "",
    inputTopic: "",
    outputUrl: "",
    outputTopic: "",
  };

  componentDidMount() {
    const { routing = {} } = this.props;
    const {
      inputUrl = "",
      inputTopic = "",
      outputUrl = "",
      outputTopic = "",
    } = routing;
    this.setState({ inputUrl, inputTopic, outputUrl, outputTopic });
  }

  componentDidUpdate(_prevProps: Props) {
    /*
    // TODO: we don't need this function at all!!
    const { inputUrl, outputUrl } = this.props;
    if(prevProps.inputUrl !== inputUrl) {
      this.setState({ inputUrl });
    }
    if(prevProps.outputUrl !== outputUrl) {
      this.setState({ outputUrl });
    }
    */
  }

  render() {
    const { inputUrl, inputTopic, outputUrl, outputTopic } = this.state;
    const { onChange } = this.props;
    const style = s(t.fs12, t.ls1);
    return (
      <div
        style={s(style, {
          display: "flex",
          flexDirection: "column",
          width: "93%",
        })}
      >
        <div style={s(t.mb5, t.fs11, t.bold)}>Board Routing</div>
        <div style={{ display: "flex", flexDirection: "row" }}>
          <InputField
            style={t.w100}
            label="Input URL"
            value={inputUrl}
            onChange={(inputUrl) => {
              if (typeof inputUrl === "string") {
                this.setState({ inputUrl }, () =>
                  onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
                );
              }
            }}
          />
          <InputField
            style={t.w100}
            label="Input Topic"
            value={inputTopic}
            onChange={(inputTopic) => {
              if (typeof inputTopic === "string") {
                this.setState({ inputTopic }, () =>
                  onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
                );
              }
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "row" }}>
          <InputField
            label="Output URL"
            value={outputUrl}
            onChange={(outputUrl) => {
              if (typeof outputUrl === "string") {
                this.setState({ outputUrl }, () =>
                  onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
                );
              }
            }}
          />
          <InputField
            label="Output Topic"
            value={outputTopic}
            onChange={(outputTopic) => {
              if (typeof outputTopic === "string") {
                this.setState({ outputTopic }, () =>
                  onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
                );
              }
            }}
          />
        </div>
      </div>
    );
  }
}
