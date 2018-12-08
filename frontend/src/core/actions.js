import qs from 'querystring';

export function currentBoardName() {
  const path = window.location.href.split('/');
  return path[path.length - 1];
}

function request(path, method='GET', body=undefined) {
  return fetch(`/api/${path}`, {
    method,
    body: body && JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export function addService(serviceDesc) {
  const board = currentBoardName();
  return request(`services?board=${board}`, 'PUT', serviceDesc);
}

export function clearBoard() {
  const board = currentBoardName();
  return request(`services?board=${board}`, 'DELETE');
}

export function getServices() {
  const board = currentBoardName();
  return request(`services?board=${board}`)
          .then(response => response.json());
}

export function getRegistry() {
  return request('registry')
    .then(response => response.json());
}

export function redirectToLogin() {
  const query = qs.stringify({
    client_id: 'oidcCLIENT',
    response_type: 'code',
    scope: 'openid',
    redirect_url: 'http://localhost/auth2app'
  });
  const target = `/openid/auth?${query}`;
  window.location.href = target;
  return false;
}
