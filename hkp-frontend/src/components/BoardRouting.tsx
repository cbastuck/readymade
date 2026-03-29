import { useState, useEffect } from "react";

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

export default function BoardRouting({ routing = {}, onChange }: Props) {
  const {
    inputUrl: initInputUrl = "",
    inputTopic: initInputTopic = "",
    outputUrl: initOutputUrl = "",
    outputTopic: initOutputTopic = "",
  } = routing;

  const [inputUrl, setInputUrl] = useState(initInputUrl);
  const [inputTopic, setInputTopic] = useState(initInputTopic);
  const [outputUrl, setOutputUrl] = useState(initOutputUrl);
  const [outputTopic, setOutputTopic] = useState(initOutputTopic);

  useEffect(() => {
    const {
      inputUrl: newInputUrl = "",
      inputTopic: newInputTopic = "",
      outputUrl: newOutputUrl = "",
      outputTopic: newOutputTopic = "",
    } = routing;
    setInputUrl(newInputUrl);
    setInputTopic(newInputTopic);
    setOutputUrl(newOutputUrl);
    setOutputTopic(newOutputTopic);
  }, [routing]);

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
          onChange={(newInputUrl) => {
            if (typeof newInputUrl === "string") {
              setInputUrl(newInputUrl);
              onChange({ inputUrl: newInputUrl, inputTopic, outputUrl, outputTopic });
            }
          }}
        />
        <InputField
          style={t.w100}
          label="Input Topic"
          value={inputTopic}
          onChange={(newInputTopic) => {
            if (typeof newInputTopic === "string") {
              setInputTopic(newInputTopic);
              onChange({ inputUrl, inputTopic: newInputTopic, outputUrl, outputTopic });
            }
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <InputField
          label="Output URL"
          value={outputUrl}
          onChange={(newOutputUrl) => {
            if (typeof newOutputUrl === "string") {
              setOutputUrl(newOutputUrl);
              onChange({ inputUrl, inputTopic, outputUrl: newOutputUrl, outputTopic });
            }
          }}
        />
        <InputField
          label="Output Topic"
          value={outputTopic}
          onChange={(newOutputTopic) => {
            if (typeof newOutputTopic === "string") {
              setOutputTopic(newOutputTopic);
              onChange({ inputUrl, inputTopic, outputUrl, outputTopic: newOutputTopic });
            }
          }}
        />
      </div>
    </div>
  );
}
