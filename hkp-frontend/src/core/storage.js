import moment from "moment";

export function setCookie(
  key,
  value,
  expCount = undefined,
  expUnit = undefined
) {
  if (value) {
    const exp =
      expCount && expUnit && moment.utc().add(expCount, expUnit).toString();
    const cookie = `${key}=${value}; ${exp ? `expires=${exp}` : ""}`;
    document.cookie = cookie;
  }
}

export function getCookie(key) {
  const cookies = document.cookie.split(";").reduce((acc, kv) => {
    if (!kv) {
      return acc;
    }
    const [key, value] = kv.split("=");
    return key && value ? { ...acc, [key.trim()]: value } : acc;
  }, {});
  return cookies[key];
}

export function removeCookie(key) {
  setCookie(key, "", -100, "y");
}

export function storeItem(key, value) {
  localStorage.setItem(key, value);
}

export function restoreItem(key) {
  return localStorage.getItem(key);
}

export function removeItem(key) {
  return localStorage.removeItem(key);
}

export function popItem(key) {
  const value = restoreItem(key);
  removeItem(key);
  return value;
}
