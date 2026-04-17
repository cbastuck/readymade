/**
 * Service Documentation
 * Service ID: hookup.to/service/lz-compress
 * Service Name: LZ Compress
 * Modes: compress | decompress
 * Key Config: mode (default: "compress")
 * IO: in=any -> out=string
 * Binary: not supported
 *
 * compress: JSON-stringifies non-strings, then lz-string compresses.
 * decompress: decompresses a URL-safe lz-string payload; if the result is
 *   valid JSON it is parsed before emitting so downstream gets an object.
 */

import * as lzstring from "lz-string";
import { AppImpl, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/lz-compress";
const serviceName = "LZ Compress";

type State = { mode: "compress" | "decompress" };

class LZCompress extends ServiceBase<State> {
  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { mode: "compress" });
  }

  configure(config: Partial<State>) {
    if (config.mode === "compress" || config.mode === "decompress") {
      this.state.mode = config.mode;
    }
  }

  process(input: any): any {
    if (this.state.mode === "decompress") {
      const str = typeof input === "string" ? input.trim() : JSON.stringify(input);
      const decompressed = lzstring.decompressFromEncodedURIComponent(str);
      if (!decompressed) { return null; }
      try {
        return JSON.parse(decompressed);
      } catch {
        return decompressed;
      }
    }
    const str = typeof input === "string" ? input : JSON.stringify(input);
    return lzstring.compressToEncodedURIComponent(str);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new LZCompress(app, board, descriptor, id),
};

export default descriptor;
