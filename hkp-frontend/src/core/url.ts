import { generateRandomName } from "./board";

type StringReturner = () => string;

// TODO: copy of runtime/services/helpers.js
function isFunction(functionToCheck: any): functionToCheck is StringReturner {
  return (
    functionToCheck && {}.toString.call(functionToCheck) === "[object Function]"
  );
}

function replaceAll(
  input: string,
  needle: string,
  replacement: string | StringReturner
) {
  let src = `${input}`;
  while (src.indexOf(needle) !== -1) {
    const rep = isFunction(replacement) ? replacement() : replacement;
    src = src.replace(needle, rep);
  }
  return src;
}

export function replacePlaceholders(url: string, params: any) {
  if (!url) {
    return;
  }

  const secure = isSecureConnection();
  const { host } = window.location;
  let rep = replaceAll(
    url,
    "%ws-host%",
    secure ? `wss://${host}` : `ws://${host}`
  );
  rep = replaceAll(
    rep,
    "%http-host%",
    secure ? `https://${host}` : `http://${host}`
  );
  rep = replaceAll(rep, "%random-name%", generateRandomName);
  if (params) {
    Object.keys(params).forEach(
      (key) => (rep = rep.replace(`%${key}%`, params[key]))
    );
  }

  return rep;
}

export function isWebsocket(url: string) {
  return url.startsWith("ws://") || url.startsWith("wss://");
}

export function isSecureConnection() {
  const { protocol } = window.location;
  return protocol.indexOf("https") === 0;
}
