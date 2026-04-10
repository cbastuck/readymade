/**
 * Service Documentation
 * Service ID: hookup.to/service/lz-compress
 * Service Name: LZ Compress
 * Modes: compress
 * Key Config: none
 * IO: in=any -> out=string (lz-string compressToEncodedURIComponent)
 * Binary: not supported
 *
 * Pure transform service. Accepts any input:
 *   - Objects/arrays are JSON-stringified first.
 *   - Strings are compressed directly.
 * Output is a URL-safe lz-string compressed string suitable for use as a
 * query parameter (e.g. ?fromLink=<output>).
 */

import * as lzstring from "lz-string";
import { AppImpl, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

const serviceId = "hookup.to/service/lz-compress";
const serviceName = "LZ Compress";

class LZCompress extends ServiceBase<{}> {
  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {});
  }

  configure() {}

  process(input: any): string {
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
