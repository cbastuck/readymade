import { generateRandomName } from "./board";
import { v4 as uuidv4 } from "uuid";

type StringReturner = () => string;

// TODO: copy of runtime/services/helpers.js
function isFunction(functionToCheck: any): functionToCheck is StringReturner {
  return (
    functionToCheck && {}.toString.call(functionToCheck) === "[object Function]"
  );
}

export function replaceAll(
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

export function replacePlaceholders(
  url: string,
  params?: { [key: string]: string }
) {
  if (!url) {
    return url;
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

  while (rep.indexOf("%uuid%") !== -1) {
    rep = rep.replace("%uuid%", uuidv4());
  }

  while (rep.indexOf("%random-name%") !== -1) {
    rep = rep.replace("%random-name%", generateRandomName);
  }

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
