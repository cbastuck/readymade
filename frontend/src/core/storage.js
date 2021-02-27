import moment from 'moment';

export function setCookie(key, value, expCount=undefined, expUnit=undefined) {
  if (value) {
    const exp = (expCount && expUnit) && moment.utc().add(expCount, expUnit).toString();
    const cookie = `${key}=${value}; ${exp ? `expires=${exp}` : '' }`;
    document.cookie = cookie;
  }
}

export function removeCookie(key) {
  setCookie(key, "removed", -100, 'y');
}

export function storeItem(key, value) {
  localStorage.setItem(key, value);
}

export function restoreItem(key) {
  return localStorage.getItem(key);
}