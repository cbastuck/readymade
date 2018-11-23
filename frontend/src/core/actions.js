function currentBoardName() {
  const path = window.location.href.split('/');
  return path[path.length - 1];
}

function request(path, method='GET', body=undefined) {
  return fetch(`/api/${path}`, {
    method,
    body: body && JSON.stringify(body)
  });
}

export function addDevice(device) {
  const board = currentBoardName();
  return request(`devices?board=${board}`, 'PUT', device);
}

export function getDevices() {
  const board = currentBoardName();
  return request(`devices?board=${board}`)
          .then(response => response.json());
}
