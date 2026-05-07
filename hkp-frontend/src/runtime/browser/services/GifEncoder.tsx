import { useEffect, useMemo, useState } from "react";

import {
  AppInstance,
  ServiceClass,
  ServiceUIProps,
} from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { encodeBlobBase64 } from "./helpers";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

const serviceId = "hookup.to/service/gif-encoder";
const serviceName = "GIF Recorder";

type GifState = {
  recording: boolean;
  delayMs: number;
  maxFrames: number;
};

type GifFrame = {
  width: number;
  height: number;
  indexedPixels: Uint8Array;
};

class ByteWriter {
  private data: number[] = [];

  writeByte(v: number) {
    this.data.push(v & 0xff);
  }

  writeBytes(bytes: number[] | Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      this.writeByte(bytes[i]);
    }
  }

  writeShort(v: number) {
    this.writeByte(v & 0xff);
    this.writeByte((v >> 8) & 0xff);
  }

  writeAscii(s: string) {
    for (let i = 0; i < s.length; i++) {
      this.writeByte(s.charCodeAt(i));
    }
  }

  toUint8Array() {
    return new Uint8Array(this.data);
  }
}

function build332Palette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const r3 = (i >> 5) & 0x07;
    const g3 = (i >> 2) & 0x07;
    const b2 = i & 0x03;
    const r = Math.round((r3 / 7) * 255);
    const g = Math.round((g3 / 7) * 255);
    const b = Math.round((b2 / 3) * 255);
    const j = i * 3;
    palette[j] = r;
    palette[j + 1] = g;
    palette[j + 2] = b;
  }
  return palette;
}

const FIXED_PALETTE = build332Palette();

function rgbaToIndexed332(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    out[j] = (r & 0xe0) | ((g & 0xe0) >> 3) | ((b & 0xc0) >> 6);
  }
  return out;
}

function lzwCompressIndexed(
  indices: Uint8Array,
  minCodeSize: number,
): Uint8Array {
  const EOF = -1;
  const BITS = 12;
  const HSIZE = 5003;
  const masks = [
    0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767,
    65535,
  ];

  const output: number[] = [];
  const htab = new Int32Array(HSIZE);
  const codetab = new Int32Array(HSIZE);

  const maxCode = (nBits: number) => (1 << nBits) - 1;

  const initCodeSize = Math.max(2, minCodeSize);
  const initBits = initCodeSize + 1;
  const clearCode = 1 << initCodeSize;
  const eofCode = clearCode + 1;

  let curAccum = 0;
  let curBits = 0;
  let nBits = initBits;
  let maxcode = maxCode(nBits);
  let freeEnt = clearCode + 2;
  let clearFlag = false;

  let pixelIndex = 0;
  const nextPixel = () => {
    if (pixelIndex >= indices.length) {
      return EOF;
    }
    return indices[pixelIndex++];
  };

  const outputCode = (code: number) => {
    curAccum &= masks[curBits];
    if (curBits > 0) {
      curAccum |= code << curBits;
    } else {
      curAccum = code;
    }

    curBits += nBits;
    while (curBits >= 8) {
      output.push(curAccum & 0xff);
      curAccum >>= 8;
      curBits -= 8;
    }

    if (freeEnt > maxcode || clearFlag) {
      if (clearFlag) {
        nBits = initBits;
        maxcode = maxCode(nBits);
        clearFlag = false;
      } else {
        nBits++;
        maxcode = nBits === BITS ? 1 << BITS : maxCode(nBits);
      }
    }

    if (code === eofCode) {
      while (curBits > 0) {
        output.push(curAccum & 0xff);
        curAccum >>= 8;
        curBits -= 8;
      }
    }
  };

  const clearHash = () => {
    htab.fill(-1);
  };

  const clearBlock = () => {
    clearHash();
    freeEnt = clearCode + 2;
    clearFlag = true;
    outputCode(clearCode);
  };

  clearHash();
  outputCode(clearCode);

  let ent = nextPixel();
  if (ent === EOF) {
    outputCode(eofCode);
    return new Uint8Array(output);
  }

  let hshift = 0;
  for (let fcode = HSIZE; fcode < 65536; fcode *= 2) {
    hshift++;
  }
  hshift = 8 - hshift;

  let c = nextPixel();
  while (c !== EOF) {
    const fcode = (c << BITS) + ent;
    let i = (c << hshift) ^ ent;
    let matched = false;

    if (htab[i] === fcode) {
      ent = codetab[i];
      c = nextPixel();
      continue;
    }

    if (htab[i] >= 0) {
      let disp = HSIZE - i;
      if (i === 0) {
        disp = 1;
      }
      do {
        i -= disp;
        if (i < 0) {
          i += HSIZE;
        }
        if (htab[i] === fcode) {
          ent = codetab[i];
          matched = true;
          break;
        }
      } while (htab[i] >= 0);

      if (matched) {
        c = nextPixel();
        continue;
      }
    }

    outputCode(ent);
    ent = c;

    if (freeEnt < 1 << BITS) {
      codetab[i] = freeEnt++;
      htab[i] = fcode;
    } else {
      clearBlock();
    }

    c = nextPixel();
  }

  outputCode(ent);
  outputCode(eofCode);

  return new Uint8Array(output);
}

function appendSubBlocks(writer: ByteWriter, data: Uint8Array) {
  let offset = 0;
  while (offset < data.length) {
    const size = Math.min(255, data.length - offset);
    writer.writeByte(size);
    writer.writeBytes(data.subarray(offset, offset + size));
    offset += size;
  }
  writer.writeByte(0);
}

function encodeGif(frames: GifFrame[], delayMs: number): Uint8Array {
  if (frames.length === 0) {
    return new Uint8Array();
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const delayCs = Math.max(1, Math.round(delayMs / 10));

  const writer = new ByteWriter();

  writer.writeAscii("GIF89a");
  writer.writeShort(width);
  writer.writeShort(height);

  // Global Color Table flag=1, color resolution=7, sort=0, table size=7 (2^(7+1)=256)
  writer.writeByte(0xf7);
  writer.writeByte(0);
  writer.writeByte(0);
  writer.writeBytes(FIXED_PALETTE);

  // Netscape loop extension: 0 means infinite looping.
  writer.writeByte(0x21);
  writer.writeByte(0xff);
  writer.writeByte(11);
  writer.writeAscii("NETSCAPE2.0");
  writer.writeByte(3);
  writer.writeByte(1);
  writer.writeShort(0);
  writer.writeByte(0);

  for (const frame of frames) {
    // Graphics Control Extension.
    writer.writeByte(0x21);
    writer.writeByte(0xf9);
    writer.writeByte(4);
    writer.writeByte(0x00);
    writer.writeShort(delayCs);
    writer.writeByte(0);
    writer.writeByte(0);

    // Image Descriptor.
    writer.writeByte(0x2c);
    writer.writeShort(0);
    writer.writeShort(0);
    writer.writeShort(frame.width);
    writer.writeShort(frame.height);
    writer.writeByte(0x00);

    writer.writeByte(8);
    const compressed = lzwCompressIndexed(frame.indexedPixels, 8);
    appendSubBlocks(writer, compressed);
  }

  writer.writeByte(0x3b);
  return writer.toUint8Array();
}

class GifEncoderService extends ServiceBase<GifState> {
  private frames: GifFrame[] = [];
  private gifUrl: string | null = null;
  private gifBytes = 0;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      recording: true,
      delayMs: 40,
      maxFrames: 300,
    });
  }

  configure(config: Partial<GifState> & { export?: boolean; clear?: boolean }) {
    if (config.recording !== undefined) {
      this.state.recording = !!config.recording;
    }
    if (config.delayMs !== undefined) {
      this.state.delayMs = Math.max(10, Math.round(config.delayMs));
    }
    if (config.maxFrames !== undefined) {
      this.state.maxFrames = Math.max(1, Math.round(config.maxFrames));
      if (this.frames.length > this.state.maxFrames) {
        this.frames = this.frames.slice(
          this.frames.length - this.state.maxFrames,
        );
      }
    }

    if (config.clear) {
      this.clearFrames();
    }

    if (config.export) {
      void this.exportGif();
    }

    this.app.notify(this, this.getStatusNotification());
  }

  getConfiguration = async () => {
    return {
      ...this.state,
      frames: this.frames.length,
      gifBytes: this.gifBytes,
      gifUrl: this.gifUrl,
      bypass: this.bypass,
    };
  };

  private clearFrames() {
    this.frames = [];
    if (this.gifUrl) {
      URL.revokeObjectURL(this.gifUrl);
      this.gifUrl = null;
    }
    this.gifBytes = 0;
  }

  private async blobToFrame(blob: Blob): Promise<GifFrame> {
    const imageBitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not create 2D context for GIF encoding");
      }
      ctx.drawImage(imageBitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return {
        width: canvas.width,
        height: canvas.height,
        indexedPixels: rgbaToIndexed332(imageData.data),
      };
    } finally {
      imageBitmap.close();
    }
  }

  private appendFrame(frame: GifFrame) {
    if (this.frames.length > 0) {
      const { width, height } = this.frames[0];
      if (frame.width !== width || frame.height !== height) {
        throw new Error(
          `Frame size changed from ${width}x${height} to ${frame.width}x${frame.height}.`,
        );
      }
    }

    this.frames.push(frame);
    if (this.frames.length > this.state.maxFrames) {
      this.frames.shift();
    }
  }

  private getStatusNotification() {
    return {
      ...this.state,
      frames: this.frames.length,
      gifBytes: this.gifBytes,
      gifUrl: this.gifUrl,
    };
  }

  private async exportGif() {
    if (this.frames.length === 0) {
      return;
    }

    const bytes = encodeGif(this.frames, this.state.delayMs);
    const blob = new Blob([bytes], { type: "image/gif" });
    this.gifBytes = bytes.byteLength;
    if (this.gifUrl) {
      URL.revokeObjectURL(this.gifUrl);
    }
    this.gifUrl = URL.createObjectURL(blob);

    this.app.notify(this, this.getStatusNotification());
    this.app.next(this, blob);
  }

  destroy() {
    if (this.gifUrl) {
      URL.revokeObjectURL(this.gifUrl);
      this.gifUrl = null;
    }
    this.frames = [];
  }

  async process(params: any) {
    if (this.state.recording && params instanceof Blob) {
      try {
        const frame = await this.blobToFrame(params);
        this.appendFrame(frame);
        this.app.notify(this, this.getStatusNotification());
      } catch (err: any) {
        this.pushErrorNotification(
          err?.message || "GIF frame processing failed",
        );
      }
    }

    // Sink behavior: do not pass-through captured frames.
    // The service emits only explicitly exported GIF blobs via exportGif().
    return null;
  }
}

function GifEncoderUI(props: ServiceUIProps) {
  const [recording, setRecording] = useState(true);
  const [frames, setFrames] = useState(0);
  const [delayMs, setDelayMs] = useState(40);
  const [maxFrames, setMaxFrames] = useState(300);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifBytes, setGifBytes] = useState(0);

  const getGifBlob = async (): Promise<Blob | null> => {
    if (!gifUrl) {
      return null;
    }
    const response = await fetch(gifUrl);
    return await response.blob();
  };

  const [gifDataUrl, setGifDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;

    if (!gifUrl) {
      setGifDataUrl(null);
      return;
    }

    void (async () => {
      const blob = await getGifBlob();
      if (!blob || cancelled) {
        if (!cancelled) {
          setGifDataUrl(null);
        }
        return;
      }
      const base64 = await encodeBlobBase64(blob);
      if (!cancelled) {
        setGifDataUrl(`data:image/gif;base64,${base64}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gifUrl]);

  const fileSizeLabel = useMemo(() => {
    if (!gifBytes) {
      return "n/a";
    }
    return `${(gifBytes / 1024).toFixed(1)} KB`;
  }, [gifBytes]);

  const onInit = (
    state: Partial<GifState> & {
      frames?: number;
      gifUrl?: string;
      gifBytes?: number;
    },
  ) => {
    setRecording(state.recording ?? true);
    setDelayMs(state.delayMs ?? 40);
    setMaxFrames(state.maxFrames ?? 300);
    setFrames(state.frames ?? 0);
    setGifUrl(state.gifUrl ?? null);
    setGifBytes(state.gifBytes ?? 0);
  };

  const onNotification = (
    n: Partial<GifState> & {
      frames?: number;
      gifUrl?: string;
      gifBytes?: number;
    },
  ) => {
    if (n.recording !== undefined) setRecording(!!n.recording);
    if (n.delayMs !== undefined) setDelayMs(n.delayMs);
    if (n.maxFrames !== undefined) setMaxFrames(n.maxFrames);
    if (n.frames !== undefined) setFrames(n.frames);
    if (n.gifUrl !== undefined) setGifUrl(n.gifUrl || null);
    if (n.gifBytes !== undefined) setGifBytes(n.gifBytes || 0);
  };

  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Delay (ms)
          <input
            type="number"
            min={10}
            value={delayMs}
            onChange={(e) => {
              const value = Math.max(10, Number(e.target.value || 40));
              setDelayMs(value);
              props.service.configure({ delayMs: value });
            }}
            style={{ width: 90 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Max Frames
          <input
            type="number"
            min={1}
            value={maxFrames}
            onChange={(e) => {
              const value = Math.max(1, Number(e.target.value || 300));
              setMaxFrames(value);
              props.service.configure({ maxFrames: value });
            }}
            style={{ width: 90 }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            className="hkp-svc-btn"
            variant="outline"
            onClick={() => props.service.configure({ recording: !recording })}
          >
            {recording ? "Stop Recording" : "Start Recording"}
          </Button>
          <Button
            className="hkp-svc-btn"
            variant="outline"
            onClick={() => props.service.configure({ export: true })}
            disabled={frames === 0}
          >
            Export GIF
          </Button>
          <Button
            className="hkp-svc-btn"
            variant="outline"
            onClick={() => props.service.configure({ clear: true })}
          >
            Clear Frames
          </Button>
        </div>
        {gifDataUrl && (
          <div className="flex flex-col">
            <img
              src={gifDataUrl}
              alt="Exported GIF preview"
              style={{
                maxWidth: "100%",
                maxHeight: 220,
                objectFit: "contain",
                border: "1px solid rgba(0,0,0,0.2)",
                borderRadius: 6,
              }}
            />
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Frames: {frames} | GIF size: {fileSizeLabel}
            </div>
          </div>
        )}
      </div>
    </ServiceUI>
  );
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new GifEncoderService(app, board, descriptor, id),
  createUI: GifEncoderUI,
};

export default descriptor;
