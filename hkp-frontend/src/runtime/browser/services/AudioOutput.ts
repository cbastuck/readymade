import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { toArrayBuffer } from "./helpers";
import { decodeBuffer } from "./audio/audioHelper";
import AudioOutputUI from "./AudioOutputUI";

const serviceId = "hookup.to/service/audio-output";
const serviceName = "Audio Output";

type State = {
  fadeInTime: number;
};

class AudioOutput extends ServiceBase<State> {
  audioCtx: AudioContext;
  analyser: AnalyserNode;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      fadeInTime: 0,
    });

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.connect(this.audioCtx.destination);
  }

  configure(config: any) {
    const { fadeInTime } = config;
    if (fadeInTime !== undefined) {
      this.state.fadeInTime = fadeInTime;
      this.app.notify(this, { fadeInTime });
    }

    if (config.command) {
      if (
        config.command.action === "visualize" &&
        config.command.params?.canvas
      ) {
        this.visualize(config.command.params.canvas);
      }
    }
  }

  destroy() {
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }

  // taken from: https://github.com/mdn/voice-change-o-matic
  visualize = (canvas: HTMLCanvasElement) => {
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    this.analyser.fftSize = 256;
    const bufferLengthAlt = this.analyser.frequencyBinCount;
    const dataArrayAlt = new Uint8Array(bufferLengthAlt);
    const canvasCtx = canvas.getContext("2d")!;
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    const drawAlt = () => {
      this.analyser.getByteFrequencyData(dataArrayAlt);
      canvasCtx.fillStyle = "white";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / bufferLengthAlt) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLengthAlt; i++) {
        const barHeight = dataArrayAlt[i];
        canvasCtx.fillStyle = `rgb(65, 131, ${barHeight + 150})`;
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
      }
      requestAnimationFrame(drawAlt);
    };

    drawAlt();
  };

  async process(params: any) {
    if (!params) {
      return params;
    }

    let source: AudioBufferSourceNode | undefined;

    if (params instanceof Blob || params instanceof File) {
      const ab = await toArrayBuffer(params);
      if (ab.byteLength > 0) {
        try {
          const buffer = await decodeBuffer(this.audioCtx, ab);
          source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
        } catch (err) {
          console.error(
            "AudioOutput decodeBuffer() failed",
            err,
            ab.byteLength,
          );
        }
      }
    }

    if (params instanceof AudioBuffer) {
      source = this.audioCtx.createBufferSource();
      source.buffer = params;
    }

    if (source) {
      const fadeInOut = this.state.fadeInTime / 1000;
      if (this.state.fadeInTime > 0) {
        const duration = source.buffer!.duration;
        const gainNode = this.audioCtx.createGain();
        source.connect(gainNode);
        gainNode.connect(this.analyser);
        gainNode.gain.linearRampToValueAtTime(0, 0);
        gainNode.gain.linearRampToValueAtTime(
          1,
          this.audioCtx.currentTime + fadeInOut,
        );
        gainNode.gain.linearRampToValueAtTime(
          1,
          this.audioCtx.currentTime + duration - fadeInOut,
        );
        gainNode.gain.linearRampToValueAtTime(
          0,
          this.audioCtx.currentTime + duration,
        );
      } else {
        source.connect(this.analyser);
      }

      source.onended = () => source!.disconnect();
      source.start();
    }

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
  ) => new AudioOutput(app, board, descriptor, id),
  createUI: AudioOutputUI,
};

export default descriptor;
