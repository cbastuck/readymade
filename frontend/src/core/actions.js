import qs from 'querystring';

import {
  removeToken,
  restoreToken
} from './Auth';

let pendingLoginRequest = null;

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
    console.log(`Request to "${path}" unauthorized redirect to login`)
    return redirectToLogin(query.board);
  }
  if (parseJSON) {
    return response.json();
  }
  return response;
}

export function getRuntimes(board) {
  return request(`board/${board}/runtimes`);
}

export function addRuntime(board, descriptor) {
  return request(`board/${board}/runtimes`, 'POST', false, descriptor)
}

export function getServices(board, runtime) {
  return request(`board/${board}/runtime/${runtime}/services`);
}

export function addService(board, descriptor) {
  return request(`board/${board}/runtime/${descriptor.runtime}/services`, 'PUT', false, descriptor);
}

export function clearBoard(board) {
  return request(`board/${board}`, 'DELETE', false);
}

export function getRuntimeRegistry(board, runtimeName) {
  return request(`board/${board}/runtime/${runtimeName}/registry`);
}

export async function getServiceConfiguration(board, service) {
  return await request(`board/${board}/runtime/${service.__descriptor.runtime}/service/${service.uuid}/config`);
}

export function configureService(board, service, config) {
  return request(`board/${board}/runtime/${service.__descriptor.runtime}/service/${service.uuid}/config`, 'POST', false, config);
}

export function getUserBoards() {
  return request('boards');
}

export function loadBoard(board) {
  redirectTo(`/${board}`);
}

export function saveBoard(board) {
  return request(`board/${board}`, 'PUT', false);
}

export function redirectUri() {
  return `${window.location.protocol}//${window.location.host}/auth2app`;
}

export function redirectTo(target, openAsPopup) {
  if (openAsPopup) {
    window.open(target, 'login-popup', 'width=450,height=430')
  } else {
    window.location.href = target;
  }  
  return false;
}

export function redirectToLogin(board) {
  if (pendingLoginRequest) {
    return;
  }
  return new Promise((resolve, reject) => {
    pendingLoginRequest = { resolve, reject };
    const query = qs.stringify({
      client_id: 'oidcCLIENT',
      response_type: 'code',
      scope: 'openid profile',
      redirect_uri: redirectUri(),
      state: board || ''
    });
    const target = `/openid/auth?${query}`;
    return redirectTo(target, true);
  });
}

export async function finishPendingLoginRequest(success) {
  if (pendingLoginRequest) {
    const { resolve, reject } = pendingLoginRequest;
    pendingLoginRequest = null;
    if (success) {
      await resolve();
      window.location.reload();
    } else {
      redirectTo('/loginFail');
      await reject();
    }
  }
}

window.finishPendingLoginRequest = finishPendingLoginRequest;