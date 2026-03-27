import { Component } from "react";
import { Video, VideoOff, FlipHorizontal } from "lucide-react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import NumberInput from "hkp-frontend/src/ui-components/NumberInput";
import Button from "hkp-frontend/src/ui-components/Button";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

type State = {
  mirror: boolean;
  recording: boolean;
  width: number;
  height: number;
  captureFormat: string;
  stream: MediaStream | null;
  devices: Array<MediaDeviceInfo>;
  currentDevice: MediaDeviceInfo | null;
};

export default class CameraUI extends Component<ServiceUIProps, State> {
  state: State = {
    mirror: true,
    recording: false,
    width: 320,
    height: 200,
    captureFormat: "image/png",
    stream: null,
    devices: [],
    currentDevice: null,
  };
  videoElement: HTMLVideoElement | null = null;
  recorder: MediaRecorder | null = null;
  canvas: HTMLCanvasElement | null = null;

  componentWillUnmount() {
    this.stopVideo();
  }

  onInit = (initialState: any) => {
    this.props.service.registerScreenshooter(this.triggerScreenshot);
    this.setState({
      ...initialState,
    });
  };

  onNotification = (notification: any) => {
    if (needsUpdate(notification.captureFormat, this.state.captureFormat)) {
      this.setState({ captureFormat: notification.captureFormat });
    }
  };

  enumerateDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );
    this.setState({ devices: videoDevices, currentDevice: videoDevices[0] });
  };

  initVideo = async (
    videoElement: HTMLVideoElement,
    deviceId?: string
  ): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = !deviceId
      ? { video: true }
      : { video: { deviceId } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    videoElement.srcObject = stream;
    videoElement.play();
    return stream;
  };

  startVideo = async (videoElement: HTMLVideoElement, deviceId?: string) => {
    if (navigator.mediaDevices) {
      const stream = await this.initVideo(videoElement, deviceId);
      this.setState({ stream });
      if (!this.state.devices.length) {
        await this.enumerateDevices();
      }
    } else {
      throw new Error("Can not initialize video");
    }
  };

  stopVideo = () => {
    const { stream } = this.state;
    if (stream) {
      if (stream.getTracks) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (stream.getVideoTracks) {
        stream.getVideoTracks().forEach((track) => track.stop());
      }
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }
      this.setState({ stream: null });
    }
  };

  startRecording = (stream: MediaStream) => {
    return new Promise((resolve, reject) => {
      this.recorder = new MediaRecorder(stream);
      const data: Array<any> = [];

      this.recorder.ondataavailable = (event) => data.push(event.data);
      this.recorder.start();

      this.recorder.onstop = () => resolve(data);
      this.recorder.onerror = (event) => reject(event);
    });
  };

  stopRecording = () => {
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.stop();
    }
  };

  triggerScreenshot = () => {
    return new Promise<Blob | null>((resolve) => {
      const { width, height } = this.state;
      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
      }
      this.canvas.width = width;
      this.canvas.height = height;
      const ctx = this.canvas.getContext("2d");
      if (ctx && this.videoElement) {
        ctx.drawImage(this.videoElement, 0, 0, width, height);
        this.canvas.toBlob(resolve, this.state.captureFormat);
      }
    });
  };

  onRecord = () => {
    const { stream } = this.state;
    this.setState({ recording: !this.state.recording }, () => {
      if (this.state.recording) {
        if (stream) {
          this.startRecording(stream).then((data: any) =>
            this.props.service.inject(new Blob(data, { type: "video/webm" }))
          );
        }
      } else {
        this.stopRecording();
      }
    });
  };

  onSnapshot = () =>
    this.props.service.configure({ action: "triggerSnapshot" });

  onChangeDevice = (device: MediaDeviceInfo | null) => {
    this.stopVideo();
    this.startVideo(this.videoElement!, device?.deviceId);
    this.setState({
      currentDevice: device,
    });
  };

  renderMain = () => {
    const mirrorStyle = this.state.mirror && {
      transform: "rotateY(180deg)",
      WebkitTransform: "rotateY(180deg)",
      MozTransform: "rotateY(180deg)",
    };
    const { stream } = this.state;
    const cameraRunning = !!stream;
    return (
      <div className="flex flex-col gap-2 mb-4">
        <div className="py-2">
          <SelectorField
            label="Device"
            options={this.state.devices.reduce(
              (all, device) => ({ ...all, [device.label]: device.label }),
              {}
            )}
            value={this.state.currentDevice?.label || ""}
            onChange={(value) =>
              this.onChangeDevice(this.state.devices[value.index] || null)
            }
          />
        </div>
        <video
          ref={(videoElement) => {
            if (!this.videoElement && videoElement) {
              this.videoElement = videoElement;
              this.startVideo(videoElement);
            } else if (videoElement && this.videoElement !== videoElement) {
              this.videoElement = videoElement; // happens e.g. on resize
            }
          }}
          className="w-full rounded-lg"
          style={{
            ...mirrorStyle,
          }}
          width={cameraRunning ? this.state.width : 0}
          height={cameraRunning ? this.state.height : 0}
          autoPlay
        />

        <div className="mt-2">
          <GroupLabel>Capture Resolution</GroupLabel>
          <div className="flex w-full gap-4 px-4 py-2">
            <NumberInput
              className="w-full"
              title="Width"
              value={this.state.width}
              onChange={(newValue) => {
                const width = Number(newValue);
                if (!isNaN(width)) {
                  this.setState({ width });
                }
              }}
            >
              px
            </NumberInput>

            <NumberInput
              className="w-full"
              title="Height"
              value={this.state.height}
              onChange={(newValue) => {
                const height = Number(newValue);
                if (!isNaN(height)) {
                  this.setState({ height });
                }
              }}
            >
              px
            </NumberInput>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <Button
            className="w-full"
            disabled={this.state.recording}
            onClick={this.onSnapshot}
          >
            Capture Snapshot
          </Button>
          <Button className="w-full" disabled={!stream} onClick={this.onRecord}>
            {this.state.recording ? "Stop Video" : "Capture Video"}
          </Button>
        </div>
      </div>
    );
  };

  render() {
    const { stream, mirror } = this.state;
    const cameraRunning = !!stream;
    const customMenuEntries = [
      {
        name: cameraRunning ? "Disable Camera" : "Enable Camera",
        icon: cameraRunning ? (
          <MenuIcon icon={VideoOff} />
        ) : (
          <MenuIcon icon={Video} />
        ),
        disabled: !cameraRunning && !this.videoElement,
        onClick: () =>
          cameraRunning
            ? this.stopVideo()
            : this.startVideo(this.videoElement!),
      },
      {
        name: mirror ? "Unmirror Image" : "Mirror Image",
        icon: <MenuIcon icon={FlipHorizontal} />,
        onClick: () => this.setState({ mirror: !mirror }),
      },
    ];
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        initialSize={{ width: 480, height: undefined }}
        customMenuEntries={customMenuEntries}
      >
        {this.renderMain()}
      </ServiceUI>
    );
  }
}
