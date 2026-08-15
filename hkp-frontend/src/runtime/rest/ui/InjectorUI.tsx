import { ServiceUIProps } from "hkp-frontend/src/types";
import {
  InjectFile,
  InjectorUIBase,
} from "../../browser/services/InjectorUI";

// Chunked so that a large file does not exceed the argument limit of apply().
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

// A remote runtime is only reachable through its REST API, so the payload
// travels as a configure call rather than as a direct pipeline push.
const injectIntoRestRuntime: InjectFile = (service, payload, asText) => {
  if (asText) {
    service.configure({ inject: payload });
  } else {
    service.configure({ injectBinary: toBase64(payload as ArrayBuffer) });
  }
};

export default function InjectorUI(props: ServiceUIProps) {
  return <InjectorUIBase {...props} injectFile={injectIntoRestRuntime} />;
}
