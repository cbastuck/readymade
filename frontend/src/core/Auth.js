import jwtDecode from 'jwt-decode';
import moment from 'moment';

export function validateToken(token) {
  if (!token || token === 'undefined') {
    return {};
  }
  const decoded = jwtDecode(token);
  const now = moment.utc();
  const exp = moment.utc(decoded.exp * 1000);
  if (now > exp) {
    return {};
  }

  return { token, decoded };
}

export function restoreToken() {
  return localStorage.getItem('token');
}

export function setToken(value) {
  localStorage.setItem('token', value);
}

export function removeToken() {
  localStorage.removeItem('token');
  removeCookie('_session');
}

function setCookie(key, value, expCount, expUnit) {
  if (value) {
    const exp = moment.utc().add(expCount, expUnit).toString();
    const cookie = `${key}=${value}; expires=${exp}`;
    document.cookie = cookie;
  }
}

function removeCookie(key) {
  setCookie(key, "removed", -100, 'y');
}

export function processToken(incomingToken) {
  const { token, decoded } = validateToken(incomingToken);
  if (!token && restoreToken()) {
    removeToken();
    return {};
  }
  return { token, username: decoded && decoded.nickname };
}
