const hasArrayBuffer = typeof ArrayBuffer === 'function';

export function isArrayBuffer(value) {
  return hasArrayBuffer && (value instanceof ArrayBuffer || toString.call(value) === '[object ArrayBuffer]');
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
    } catch(err) {
      reject(err);
    }
  });
}

export function filterPrivateMembers(service) {
  return service && Object.keys(service).reduce(
    (res, cur) =>
      (cur[0] === '_' || cur === 'app') ?
        res :
        { ...res, [cur]: service[cur] },
    {}
  );
}

export function isObject(x) {
  return Object.prototype.toString.call(x) === '[object Object]';
}

export function createObjectURL(object, type) {
  const b = isArrayBuffer(object) ?  
    new Blob([ object ], type) :
    object;
  try {
    return window.URL ? 
      window.URL.createObjectURL(b) : 
      window.webkitURL.createObjectURL(b);
  } catch (err) {
    console.warn(`Can not create data url from: ${b}`);    
  }
}

export function revokeObjectURL(object) {
  return window.URL ? 
    window.URL.revokeObjectURL(object) : 
    window.webkitURL.revokeObjectURL(object);
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
  return getMobileOperatingSystem() === 'iOS';
}
