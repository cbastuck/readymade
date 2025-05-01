import {
  useParams,
  useLocation,
  useNavigate,
  NavigateFunction,
  Location,
} from "react-router-dom";
import * as lzstring from "lz-string";
import { RuntimeClass } from "./types";

export function isTouchDevice() {
  return "ontouchstart" in window;
}

export type WithRouterProps = {
  match: {
    params: { [key: string]: string | undefined };
  };
  location: Location;
  navigate: NavigateFunction;
};

export function withRouter(WrappedComponent: any) {
  return (props: any) => {
    const navigate = useNavigate();
    return (
      <WrappedComponent
        {...props}
        match={{ params: { ...useParams() } }}
        location={{ ...useLocation() }}
        navigate={navigate}
      />
    );
  };
}

export async function hashString(message: string) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}

export type Rect = Size & Point;

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: string | number | undefined;
  height: string | number | undefined;
};

export function assureJSON(value: string | object): object {
  return typeof value === "string" ? JSON.parse(value) : value;
}

export function stringifyIfNeeded(value: string | object): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function compressAndEncodeState(state: string): string {
  return lzstring.compressToEncodedURIComponent(state);
}

export function decompressAndDecodeState(encoded: string): string {
  return lzstring.decompressFromEncodedURIComponent(
    decodeURIComponent(encoded)
  );
}

export function delayedExec(fn: () => any, delay: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      fn();
      resolve();
    }, delay);
  });
}

export function runDeferred(f: () => void, delay: number) {
  return setTimeout(f, delay);
}

export function restoreAvailableRuntimeEngines(): Array<RuntimeClass> {
  return JSON.parse(localStorage.getItem("available-remote-runtimes") || "[]");
}

export function storeAvailableRuntimeEngines(engines: RuntimeClass[]) {
  const filteredEngines = engines.filter(
    (rt) => rt.type === "remote" || rt.type === "realtime"
  );

  localStorage.setItem(
    "available-remote-runtimes",
    JSON.stringify(filteredEngines)
  );
}
