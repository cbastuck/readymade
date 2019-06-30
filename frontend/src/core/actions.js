import qs from 'querystring';

import {
  removeToken,
  restoreToken
} from './Auth';

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
    const query = qs.parse(path.split('?')[1]);
    return redirectToLogin(query.board);
  }
  if (parseJSON) {
    return response.json();
  }
  return response;
}

export function addService(board, serviceDesc) {
  return request(`services?board=${board}`, 'PUT', false, serviceDesc);
}

export function clearBoard(board) {
  return request(`services?board=${board}`, 'DELETE', false);
}

export function loadBoard(board) {
  redirectTo(`/${board}`);
}

export function saveBoard(board) {
  return request(`board/${board}`, 'PUT', false);
}

export function getServices(board) {
  return request(`services?board=${board}`);
}

export function getRegistry() {
  return request(`registry`);
}

export function configureService(board, service, config) {
  return request(`config?board=${board}`, 'POST', false, { service, config });
}

export async function getServiceConfiguration(board, service) {
  return await request(`config?board=${board}&service=${service.uuid}`);
}

export function getUserBoards() {
  return request('boards');
}

export function redirectUri() {
  return `${window.location.protocol}//${window.location.host}/auth2app`;
}

export function redirectTo(target) {
  window.location.href = target;
  return false;
}

export function redirectToLogin(board) {
  const query = qs.stringify({
    client_id: 'oidcCLIENT',
    response_type: 'code',
    scope: 'openid profile',
    redirect_uri: redirectUri(),
    state: board || ''
  });
  const target = `/openid/auth?${query}`;
  return redirectTo(target);
}
