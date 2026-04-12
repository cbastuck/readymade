export function isObject(x: any): boolean {
  return Object.prototype.toString.call(x) === "[object Object]"; // strict JSON object check
}

export function isSomeObject(x: any): boolean {
  return typeof x === "object"; // not true for e.g. [object AnalyserNode], [object Blob], [object String] etc.
}

export function isFunction(functionToCheck: any): boolean {
  return (
    // functionToCheck && {}.toString.call(functionToCheck) === "[object Function]"
    typeof functionToCheck === "function"
  );
}

export function isBlob(data: any): data is Blob {
  return data instanceof Blob;
}

export function isArrayBuffer(value: any): value is ArrayBuffer {
  const hasArrayBuffer = typeof ArrayBuffer === "function";
  return (
    hasArrayBuffer &&
    (value instanceof ArrayBuffer ||
      toString.call(value) === "[object ArrayBuffer]")
  );
}

export function toArrayBuffer(blobOrFile: Blob | File): Promise<ArrayBuffer> {
  if ((blobOrFile as any).arrayBuffer) {
    return (blobOrFile as any).arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    try {
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.readAsArrayBuffer(blobOrFile);
    } catch (err) {
      reject(err);
    }
  });
}

export function encodeBlobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function filterPrivateMembers(
  service: Record<string, any> | null | undefined,
): Record<string, any> | undefined {
  if (!service) {
    return undefined;
  }
  return Object.keys(service).reduce<Record<string, any>>(
    (res, cur) =>
      cur[0] === "_" || cur === "app" ? res : { ...res, [cur]: service[cur] },
    {},
  );
}

const nonConfigServiceKeys = new Set([
  "uuid",
  "serviceId",
  "serviceName",
  "board",
  "app",
  "descriptor",
  "__descriptor",
  "state",
]);

export function extractServiceConfiguration(
  service: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!service) {
    return {};
  }

  const publicMembers = filterPrivateMembers(service) || {};
  const state =
    service.state && typeof service.state === "object" ? service.state : {};
  const merged = {
    ...publicMembers,
    ...state,
  };

  return Object.keys(merged).reduce<Record<string, any>>((acc, key) => {
    if (nonConfigServiceKeys.has(key) || isFunction(merged[key])) {
      return acc;
    }
    return {
      ...acc,
      [key]: merged[key],
    };
  }, {});
}

export function createObjectURL(
  object: ArrayBuffer | Uint8Array | Blob,
  type?: BlobPropertyBag,
): string | undefined {
  const b =
    isArrayBuffer(object) || object instanceof Uint8Array
      ? new Blob(
          [object instanceof Uint8Array ? new Uint8Array(object) : object],
          type,
        )
      : object;
  try {
    return window.URL
      ? window.URL.createObjectURL(b)
      : (window as any).webkitURL.createObjectURL(b);
  } catch (err) {
    console.warn(`Can not create data url from: ${b}`);
  }
}

export function revokeObjectURL(object: string): void {
  return window.URL
    ? window.URL.revokeObjectURL(object)
    : (window as any).webkitURL.revokeObjectURL(object);
}

function getMobileOperatingSystem(): string {
  var userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;

  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return "Windows Phone";
  }

  if (/android/i.test(userAgent)) {
    return "Android";
  }

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    return "iOS";
  }

  return "unknown";
}

export function detectBrowserIOS(): boolean {
  return getMobileOperatingSystem() === "iOS";
}

export function removeKeyFromObject(
  obj: Record<string, any>,
  key: string,
): Record<string, any> {
  return Object.keys(obj).reduce<Record<string, any>>(
    (acc, k) =>
      k === key
        ? acc
        : {
            ...acc,
            [k]: obj[k],
          },
    {},
  );
}

export function makeQueryString(obj: Record<string, any>): string {
  return Object.keys(obj).reduce(
    (str, key) =>
      obj[key]
        ? str.length
          ? `${str}&${key}=${obj[key]}`
          : `${key}=${obj[key]}`
        : str,
    "",
  );
}

export class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class Debouncer {
  deferTime: number;
  timeout: ReturnType<typeof setTimeout> | null;

  constructor(time: number = 100) {
    this.deferTime = time;
    this.timeout = null;
  }

  f(c: () => void): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.timeout = setTimeout(c, this.deferTime);
  }

  clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}

export function sleep(t: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 v4 variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  // Last-resort fallback for very old/limited environments.
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
