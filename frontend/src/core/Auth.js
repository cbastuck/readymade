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

export function getUserId() {
  const token = restoreToken();
  if (!token) {
    return;
  }
  const { userId } = processToken(token);
  return userId;
}

export function restoreToken() {
  return localStorage.getItem('token');
}

export function setToken(value) {
  localStorage.setItem('token', value);
  setCookie('token', value);
}

export function removeToken() {
  localStorage.removeItem('token');
  removeCookie('token');
  removeCookie('_session');
}

function setCookie(key, value, expCount=undefined, expUnit=undefined) {
  if (value) {
    const exp = (expCount && expUnit) && moment.utc().add(expCount, expUnit).toString();
    const cookie = `${key}=${value}; ${exp ? `expires=${exp}` : '' }`;
    document.cookie = cookie;
  }
}

function removeCookie(key) {
  setCookie(key, "removed", -100, 'y');
}

export function processToken(incomingToken) {
  const { token, decoded } = validateToken(incomingToken);
  if (!token && restoreToken()) {
    removeToken(); // the stored token token is not valid anymore
    return {};
  }

  return { 
    token, 
    username: decoded && decoded.nickname,
    userId: decoded && decoded.sub,
    features: decoded && JSON.parse(decoded.features || '{}'),
  };
}
