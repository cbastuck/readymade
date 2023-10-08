import React, { Component } from "react";
import { Checkbox, Button } from "semantic-ui-react";

import ServiceUI from "./ServiceUI";
import { s, t } from "../../styles";
import InputField from "../../components/shared/InputField";

const serviceId = "hookup.to/service/camera";
const serviceName = "Camera";

export class CameraUI extends Component {
  state = {
    mirror: true,
    recording: false,
    width: 320,
    height: 200,
    captureFormat: "image/png",
  };

  componentWillUnmount() {
    this.stopVideo();
  }

  onInit(service) {
    service.registerUI(this);
    this.setState({
      ...service,
    });
  }

  onNotification = (service, notification) => {
    const { captureFormat } = notification;
    if (captureFormat !== undefined) {
      this.setState({ captureFormat });
    }
  };

  initVideo = async (videoElement) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    //videoElement.src = window.URL.createObjectURL(stream);
    videoElement.srcObject = stream;
    videoElement.play();
    return stream;
  };

  initVideoLegacy = (video) => {
    let res;
    if (navigator.getUserMedia) {
      // Standard
      navigator.getUserMedia(
        { video: true },
        (stream) => {
          res = stream;
          video.src = stream;
          video.play();
        },
        (err) => console.warn("initVideoLegacy", err)
      );
    } else if (navigator.webkitGetUserMedia) {
      // WebKit-prefixed
      navigator.webkitGetUserMedia(
        { video: true },
        (stream) => {
          res = stream;
          video.src = window.webkitURL.createObjectURL(stream);
          video.play();
        },
        (err) => console.warn("initVideoLegacy", err)
      );
    } else if (navigator.mozGetUserMedia) {
      // Mozilla-prefixed
      navigator.mozGetUserMedia(
        { video: true },
        (stream) => {
          res = stream;
          video.srcObject = stream;
          video.play();
        },
        (err) => console.warn("initVideoLegacy", err)
      );
    }
    return res;
  };

  startVideo = async (videoElement) => {
    let stream;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      stream = await this.initVideo(videoElement);
    } else {
      stream = this.initVideoLegacy(videoElement);
    }
    this.setState({ stream });
  };

  stopVideo = () => {
    const { stream } = this.state;
    if (stream) {
      if (stream.getTracks) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      } else if (stream.stop) {
        stream.stop();
      } else {
        console.warn("No way to stop the stream?");
      }

      this.videoElement.srcObject = null;
      this.setState({ stream: null });
    }
  };

  startRecording(stream) {
    return new Promise((resolve, reject) => {
      this.recorder = new MediaRecorder(stream);
      let data = [];

      this.recorder.ondataavailable = (event) => data.push(event.data);
      this.recorder.start();

      this.recorder.onstop = () => resolve(data);
      this.recorder.onerror = (event) => reject(event);
    });
  }

  stopRecording() {
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.stop();
    }
  }

  triggerScreenshot() {
    return new Promise((resolve) => {
      const { width, height } = this.state;
      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
      }
      this.canvas.width = width;
      this.canvas.height = height;
      const ctx = this.canvas.getContext("2d");
      ctx.drawImage(this.videoElement, 0, 0, width, height);
      this.canvas.toBlob(resolve, this.state.captureFormat);
    });
  }

  renderMain = (service) => {
    const mirrorStyle = this.state.mirror && {
      transform: "rotateY(180deg)",
      WebkitTransform: "rotateY(180deg)" /* Safari and Chrome */,
      MozTransform: "rotateY(180deg)" /* Firefox */,
    };
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <video
          ref={(videoElement) => {
            if (!this.videoElement) {
              this.videoElement = videoElement;
              this.startVideo(videoElement);
            } else if (videoElement && this.videoElement !== videoElement) {
              this.videoElement = videoElement; // happens e.g. on resize
            }
          }}
          style={{
            border: "solid 1px lightgray",
            borderRadius: 5,
            width: "100%",
            ...mirrorStyle,
          }}
          width={this.state.width}
          height={this.state.height}
          autoPlay
        />
        <div style={{ textAlign: "left", marginBottom: 5, width: "100%" }}>
          <Checkbox
            style={s(t.uc, t.fs11)}
            label="Mirror"
            checked={this.state.mirror}
            onChange={(_, { checked }) => this.setState({ mirror: checked })}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
          }}
        >
          <InputField
            label="width"
            value={this.state.width}
            onChange={(ev, { value }) => {
              const width = Number(value);
              if (!isNaN(width)) {
                this.setState({ width });
              }
            }}
            style={{ minWidth: 80 }}
          />

          <InputField
            label="height"
            value={this.state.height}
            onChange={(ev, { value }) => {
              const height = Number(value);
              if (!isNaN(height)) {
                this.setState({ height });
              }
            }}
            style={{ minWidth: 80 }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
          }}
        >
          <Button
            style={s(t.uc, t.fs12, t.w100)}
            disabled={!!this.state.stream && !!this.videoElement}
            onClick={() => this.startVideo(this.videoElement)}
          >
            Start
          </Button>
          <Button
            style={s(t.uc, t.fs12, t.w100)}
            disabled={!this.state.stream}
            onClick={() => this.stopVideo()}
          >
            Stop
          </Button>
        </div>
        <Button
          style={s(t.uc, t.fs12, { marginTop: 3, width: "100%" })}
          disabled={!this.state.stream}
          onClick={() =>
            this.setState({ recording: !this.state.recording }, () => {
              if (this.state.recording) {
                this.startRecording(this.state.stream).then((data) =>
                  service.inject(new Blob(data, { type: "video/webm" }))
                );
              } else {
                this.stopRecording();
              }
            })
          }
        >
          {this.state.recording ? "Stop" : "Capture"}
        </Button>
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[{ name: "Main", render: this.renderMain }]}
      />
    );
  }
}

class Camera {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.captureAs = "image";
    this.captureFormat = "image/png";
  }

  configure(config) {
    const { captureAs, captureFormat } = config;
    if (captureAs !== undefined) {
      this.captureAs = captureAs;
    }

    if (captureFormat !== undefined) {
      this.captureFormat = captureFormat;
      this.app.notify(this, { captureFormat });
    }
  }

  inject(blob) {
    setImmediate(() => this.app.next(this, blob));
  }

  registerUI(ui) {
    if (ui) {
      this._ui = ui;
    }
  }

  async process(params) {
    if (this._ui) {
      const image = await this._ui.triggerScreenshot();
      return this.captureAs
        ? {
            ...params,
            [this.captureAs]: image,
          }
        : image;
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Camera(app, board, descriptor, id),
  createUI: CameraUI,
};

export default descriptor;
