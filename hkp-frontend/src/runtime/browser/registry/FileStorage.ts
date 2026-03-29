let DropboxSourceDescriptor: any;
let DropboxSinkDescriptor: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DropboxSourceDescriptor = require("../services/DropboxSource").default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DropboxSinkDescriptor = require("../services/DropboxSink").default;
} catch {
  // modules not available
}

export default function fileRegistry(): any[] {
  return [DropboxSourceDescriptor, DropboxSinkDescriptor].filter(Boolean);
}
