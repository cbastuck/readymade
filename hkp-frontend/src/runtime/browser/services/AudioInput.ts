import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { FloatRingBufferSymbol } from "hkp-frontend/src/runtime/rest/Data";
import ServiceBase from "./ServiceBase";
import AudioInputUI from "./AudioInputUI";

const serviceId = "hookup.to/service/audio-input";
const serviceName = "Audio Input";

// The pcm format resamples to this rate before emitting — it is the rate
// speech models (Whisper family) expect; consumers rely on this contract
// because FloatRingBuffer carries no sample-rate field.
export const PCM_SAMPLE_RATE = 16000;

export type AudioInputFormat = "blob" | "pcm";

type State = {
  timeslice: number;
  isRecording: boolean;
  availableDevices: MediaDeviceInfo[];
  format: AudioInputFormat;
};

type PcmCapture = {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  chunks: Float32Array[];
};

// Captures channel 0 and posts each render quantum to the main thread. The
// processor writes no output, so connecting it to the destination is silent.
const captureWorkletSource = `
class HkpCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}
registerProcessor("hkp-capture", HkpCaptureProcessor);
`;

function downsampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) {
    return input;
  }
  const ratio = fromRate / toRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

class AudioInput extends ServiceBase<State> {
  recorder: MediaRecorder | undefined;
  _stream: MediaStream | undefined;
  _pcm: PcmCapture | undefined;
  _pcmBufferId: number = 0;

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
      format: "blob",
    });
    this.recorder = undefined;
    this._stream = undefined;
    this.prepareStream();
  }

  async configure(config: any) {
    const { timeslice, device, format } = config;

    if (timeslice !== undefined) {
      this.state.timeslice = timeslice;
      this.app.notify(this, { timeslice });
      if (this.state.isRecording) {
        this.startRecorder(timeslice);
      }
    }

    if (format === "blob" || format === "pcm") {
      this.state.format = format;
      this.app.notify(this, { format });
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

    if (this.state.format === "pcm") {
      void this.startPcmCapture();
      return;
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
    if (this._pcm) {
      void this.stopPcmCapture();
      return;
    }
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = undefined;
      this.state.isRecording = false;
      this.app.notify(this, { isRecording: false });
    }
  }

  async startPcmCapture() {
    if (!this._stream) {
      await this.prepareStream();
    }
    if (!this._stream || this._pcm) {
      return;
    }

    try {
      const context = new AudioContext();
      const moduleUrl = URL.createObjectURL(
        new Blob([captureWorkletSource], { type: "application/javascript" }),
      );
      let node: AudioWorkletNode;
      try {
        await context.audioWorklet.addModule(moduleUrl);
        node = new AudioWorkletNode(context, "hkp-capture");
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }

      const chunks: Float32Array[] = [];
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        chunks.push(event.data);
      };

      const source = context.createMediaStreamSource(this._stream);
      source.connect(node);
      node.connect(context.destination); // required to drive processing; output is silent

      this._pcm = { context, source, node, chunks };
      this.state.isRecording = true;
      this.app.notify(this, { isRecording: true });
    } catch (err) {
      console.error("AudioInput: failed to start pcm capture:", err);
      this.pushErrorNotification("Could not start PCM audio capture");
    }
  }

  async stopPcmCapture() {
    const pcm = this._pcm;
    if (!pcm) {
      return;
    }
    this._pcm = undefined;

    pcm.node.port.onmessage = null;
    pcm.source.disconnect();
    pcm.node.disconnect();
    const captureRate = pcm.context.sampleRate;
    await pcm.context.close();

    this.state.isRecording = false;
    this.app.notify(this, { isRecording: false });

    const totalLength = pcm.chunks.reduce((n, chunk) => n + chunk.length, 0);
    if (totalLength === 0) {
      return;
    }
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of pcm.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const resampled = downsampleLinear(samples, captureRate, PCM_SAMPLE_RATE);
    this.app.next(this, {
      type: FloatRingBufferSymbol,
      array: new Uint8Array(resampled.buffer),
      id: this._pcmBufferId++,
      ts: Date.now(),
    });
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
