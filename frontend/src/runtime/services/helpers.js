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

export function detectBrowserIOS() {
  const ua = window && window.navigator && window.navigator.userAgent;
  if (ua) {
    return false;
  }
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  const iOSSafari = iOS && webkit && !ua.match(/CriOS/i);
  return iOSSafari;
}

export function iOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}
