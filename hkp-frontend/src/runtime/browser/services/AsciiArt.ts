import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import AsciiArtUI from "./AsciiArtUI";

const serviceId = "hookup.to/service/ascii-art";
const serviceName = "ASCII Art";

// 10-step ramp, light → dark.  Works well for typical camera input.
const DEFAULT_CHARSET = " .:-=+*#%@";
const DEFAULT_COLS = 100;
const DEFAULT_ROWS = 60;

type State = {
  cols: number;
  rows: number;
  charset: string;
  invert: boolean;
  imageKey: string;
};

class AsciiArt extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      charset: DEFAULT_CHARSET,
      invert: false,
      imageKey: "image",
    });
  }

  configure(config: any): void {
    const { cols, rows, charset, invert, imageKey } = config;
    if (cols !== undefined) {
      this.state.cols = Number(cols);
      this.app.notify(this, { cols: this.state.cols });
    }
    if (rows !== undefined) {
      this.state.rows = Number(rows);
      this.app.notify(this, { rows: this.state.rows });
    }
    if (charset !== undefined) {
      this.state.charset = charset;
    }
    if (invert !== undefined) {
      this.state.invert = !!invert;
      this.app.notify(this, { invert: this.state.invert });
    }
    if (imageKey !== undefined) {
      this.state.imageKey = imageKey;
    }
  }

  async process(params: any): Promise<any> {
    const blob: Blob | undefined = params?.[this.state.imageKey];
    if (!blob || !(blob instanceof Blob)) {
      return params;
    }

    try {
      const bitmap = await createImageBitmap(blob);
      const cols = this.state.cols;
      const rows = this.state.rows;

      const canvas = document.createElement("canvas");
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, cols, rows);
      bitmap.close();

      const { data } = ctx.getImageData(0, 0, cols, rows);
      const { charset, invert } = this.state;
      const lastIdx = charset.length - 1;

      const lines: string[] = [];
      for (let y = 0; y < rows; y++) {
        let line = "";
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          let idx = Math.round((lum / 255) * lastIdx);
          if (invert) idx = lastIdx - idx;
          line += charset[idx];
        }
        lines.push(line);
      }

      // Drop the original Blob — it can't be serialised and isn't needed downstream.
      const { [this.state.imageKey]: _drop, ...rest } = params;
      return { ...rest, ascii: lines.join("\n") };
    } catch (err) {
      console.error("AsciiArt.process", err);
      return params;
    }
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
  ) => new AsciiArt(app, board, descriptor, id),
  createUI: AsciiArtUI as any,
};

export default descriptor;
