export function replacePlaceholders(url) {
  const secure = isSecureConnection();
  const { host } = window.location;
  let rep = url.replace('%ws-host%', secure ? `wss://${host}` : `ws://${host}`);
  rep = rep.replace('%http-host%', secure ? `https://${host}` : `http://${host}`);
  return rep;
}

export function isWebsocket(url) {
  return url.startsWith('ws://') || url.startsWith('wss://');
}

export function isSecureConnection() {
  const { protocol } = window.location;
  return protocol.indexOf('https') === 0;
}