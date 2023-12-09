export function isObject(x) {
  return Object.prototype.toString.call(x) === "[object Object]"; // strict JSON object check
}

export function isSomeObject(x) {
  return typeof x === "object"; // not true for e.g. [object AnalyserNode], [object Blob], [object String] etc.
}

export function isFunction(functionToCheck) {
  return (
    // functionToCheck && {}.toString.call(functionToCheck) === "[object Function]"
    typeof functionToCheck === "function"
  );
}

export function isBlob(data) {
  return data instanceof Blob;
}

export function isArrayBuffer(value) {
  const hasArrayBuffer = typeof ArrayBuffer === "function";
  return (
    hasArrayBuffer &&
    (value instanceof ArrayBuffer ||
      toString.call(value) === "[object ArrayBuffer]")
  );
}

export function toArrayBuffer(blobOrFile) {
  if (blobOrFile.arrayBuffer) {
    return blobOrFile.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    try {
      fr.onload = () => resolve(fr.result);
      fr.readAsArrayBuffer(blobOrFile);
    } catch (err) {
      reject(err);
    }
  });
}

export function encodeBlobBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function filterPrivateMembers(service) {
  return (
    service &&
    Object.keys(service).reduce(
      (res, cur) =>
        cur[0] === "_" || cur === "app" ? res : { ...res, [cur]: service[cur] },
      {}
    )
  );
}

export function createObjectURL(object, type) {
  const b =
    isArrayBuffer(object) || object instanceof Uint8Array
      ? new Blob([object], type)
      : object;
  try {
    return window.URL
      ? window.URL.createObjectURL(b)
      : window.webkitURL.createObjectURL(b);
  } catch (err) {
    console.warn(`Can not create data url from: ${b}`);
  }
}

export function revokeObjectURL(object) {
  return window.URL
    ? window.URL.revokeObjectURL(object)
    : window.webkitURL.revokeObjectURL(object);
}

function getMobileOperatingSystem() {
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return "Windows Phone";
  }

  if (/android/i.test(userAgent)) {
    return "Android";
  }

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return "iOS";
  }

  return "unknown";
}

export function detectBrowserIOS() {
  return getMobileOperatingSystem() === "iOS";
}

export function removeKeyFromObject(obj, key) {
  return Object.keys(obj).reduce(
    (acc, k) =>
      k === key
        ? acc
        : {
            ...acc,
            [k]: obj[k],
          },
    {}
  );
}

export function makeQueryString(obj) {
  return Object.keys(obj).reduce(
    (str, key) =>
      obj[key]
        ? str.length
          ? `${str}&${key}=${obj[key]}`
          : `${key}=${obj[key]}`
        : str,
    ""
  );
}

export class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class Debouncer {
  constructor(time = 100) {
    this.deferTime = time;
  }

  f(c) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.timeout = setTimeout(c, this.deferTime);
  }

  clear() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}

export function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}
