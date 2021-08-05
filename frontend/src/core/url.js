export function replacePlaceholders(url, params) {
  if (!url) {
    return;
  }

  const secure = isSecureConnection();
  const { host } = window.location;
  let rep = url.replace('%ws-host%', secure ? `wss://${host}` : `ws://${host}`);
  rep = rep.replace('%http-host%', secure ? `https://${host}` : `http://${host}`);
  if (params) {
    Object.keys(params).forEach(key => rep = rep.replace(`%${key}%`, params[key]));
  }

  return rep;
}

export function isWebsocket(url) {
  return url.startsWith('ws://') || url.startsWith('wss://');
}

export function isSecureConnection() {
  const { protocol } = window.location;
  return protocol.indexOf('https') === 0;
}