import qs from 'querystring';

import {
  removeToken,
  restoreToken
} from './Auth';

export function setCurrentBoardName(name) {
  localStorage.setItem('board', name);
}

export function currentBoardName() {
  const name = localStorage.getItem('board');
  return name;
}

async function request(path, method='GET', parseJSON=true, body=undefined) {
  const response = await fetch(`/api/${path}`, {
    method,
    body: body && JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': restoreToken() || '',
    }
  });
  const status = response.status;
  if (status === 401) {
    removeToken();
    return redirectToLogin();
  }
  if (parseJSON) {
    return response.json();
  }
  return response;
}

export function addService(serviceDesc) {
  const board = currentBoardName();
  return request(`services?board=${board}`, 'PUT', false, serviceDesc);
}

export function clearBoard() {
  const board = currentBoardName();
  return request(`services?board=${board}`, 'DELETE', false);
}

export function getServices() {
  const board = currentBoardName();
  return request(`services?board=${board}`);
}

export function getRegistry() {
  return request('registry');
}

export function configureService(service, config) {
  const board = currentBoardName();
  return request(`config?board=${board}`, 'POST', false, { service, config });
}

export async function getServiceConfiguration(service) {
  const board = currentBoardName();
  return await request(`config?board=${board}&service=${service.uuid}`);
}

export function redirectUri() {
  return `${window.location.protocol}//${window.location.host}/auth2app`;
}

export function redirectTo(target) {
  window.location.href = target;
  return false;
}

export function redirectToLogin() {
  const board = currentBoardName();
  const query = qs.stringify({
    client_id: 'oidcCLIENT',
    response_type: 'code',
    scope: 'openid profile',
    redirect_uri: redirectUri(),
    state: board
  });
  const target = `/openid/auth?${query}`;
  return redirectTo(target);
}
