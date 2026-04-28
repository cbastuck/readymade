import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import AudioInputUI from "./AudioInputUI";

const serviceId = "hookup.to/service/audio-input";
const serviceName = "Audio Input";

type State = {
  timeslice: number;
  isRecording: boolean;
  availableDevices: MediaDeviceInfo[];
};

class AudioInput extends ServiceBase<State> {
  recorder: MediaRecorder | undefined;
  _stream: MediaStream | undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      timeslice: 1000,
      isRecording: false,
      availableDevices: [],
    });
    this.recorder = undefined;
    this._stream = undefined;
    this.prepareStream();
  }

  async configure(config: any) {
    const { timeslice, device } = config;

    if (timeslice !== undefined) {
      this.state.timeslice = timeslice;
      this.app.notify(this, { timeslice });
      if (this.state.isRecording) {
        this.startRecorder(timeslice);
      }
    }

    if (device !== undefined) {
      await this.prepareStream(device);
    }

    if (config.command) {
      if (config.command.action === "start-recording") {
        this.startRecorder(config.command.params?.timeslice || this.state.timeslice);
      } else if (config.command.action === "stop-recording") {
        this.stopRecorder();
      }
    }
  }

  destroy() {
    this.stopRecorder();
    if (this._stream) {
      this._stream.getTracks().forEach((track) => track.stop());
    }
  }

  async prepareStream(device?: MediaDeviceInfo) {
    if (navigator.mediaDevices?.ondevicechange !== undefined) {
      const updateDeviceList = async () => {
        this.state.availableDevices = await navigator.mediaDevices.enumerateDevices();
        this.app.notify(this, { availableDevices: this.state.availableDevices });
      };
      navigator.mediaDevices.ondevicechange = updateDeviceList;
      await updateDeviceList();
    }

    if (navigator.mediaDevices) {
      const constraints = device
        ? { audio: { deviceId: { exact: device.deviceId } } }
        : { audio: true };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this._stream) {
        this.app.notify(this, { stream: this._stream });
      }
    }
  }

  startRecorder(timeslice: number) {
    if (this.state.isRecording) {
      this.stopRecorder();
    }

    try {
      if (!this.recorder) {
        this.recorder = new MediaRecorder(this._stream!);
        this.recorder.addEventListener("dataavailable", (e: BlobEvent) => {
          if (e.data && e.data.size > 100) {
            this.app.next(this, e.data);
          }
        });
      }
    } catch (err) {
      console.error("Unexpected error in AudioInput service:", err);
      return;
    }
    this.recorder.start(timeslice);
    this.state.isRecording = true;
    this.app.notify(this, { isRecording: true });
  }

  stopRecorder() {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = undefined;
      this.state.isRecording = false;
      this.app.notify(this, { isRecording: false });
    }
  }

  async process(params: any) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new AudioInput(app, board, descriptor, id),
  createUI: AudioInputUI,
};

export default descriptor;
