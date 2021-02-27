import jwtDecode from 'jwt-decode';
import moment from 'moment';

import { 
  setCookie, 
  removeCookie,
  storeItem,
  restoreItem,
} from './storage';

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
  return restoreItem('token');
}

export function setToken(value) {
  storeItem('token', value);
  setCookie('token', value);
}

export function removeToken() {
  localStorage.removeItem('token');
  removeCookie('token');
  removeCookie('_session');
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
