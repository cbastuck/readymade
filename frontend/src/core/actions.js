import queryString from 'query-string';
import {
  removeToken,
  restoreToken
} from './Auth';

function queryParams() {
  const { ownerId } = queryString.parse(window.location.search);
  return queryString.stringify({ ownerId });
}

// TODO: this implementation should not be in this file
async function serializeObject(body) {
  if (!body) {
    return {
      contentType: undefined,
      body: undefined,
    };
  }
  
  if (body instanceof Blob) {
    return {
      contentType: body.type,
      body: await new Response(body).arrayBuffer(),
    };
  }

  const firstLevelBlobs = Object.keys(body).filter(key => body[key] instanceof Blob);
  if (firstLevelBlobs.length === 0) {
    return { 
      contentType: 'application/json',
      body: JSON.stringify(body),
    };
  }

  const createBlobKey = key => `+binary-data-@${key}`;
  const formData = new FormData();
  formData.append(
    'json', 
    JSON.stringify({ 
      ...body,
      ...firstLevelBlobs.reduce((acc, key) => 
        ({ ...acc, [key]: createBlobKey(key) }),
        {},
      )
    })
  );
  firstLevelBlobs.forEach(key => {
    const blobKey = createBlobKey(key);
    formData.append(blobKey, body[key], blobKey);
  });

  return {
    contentType: undefined, // by browser with boundary 'multipart/form-data',
    body: formData,
  }
}

export async function request(path, method='GET', parseJSON=true, body=undefined) {
  const { 
    body: serialisedBody, 
    contentType 
  } = await serializeObject(body);

  const headers = {
    'Authorization': restoreToken() || '',
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  const response = await fetch(`/api/${path}`, {
    method,
    headers,
    body: serialisedBody,
  });
  const status = response.status;
  if (status === 401) {
    removeToken();
    return;
  }
  if (parseJSON) {
    return response.json();
  }
  return response;
}

export function getRuntimes(board) {
  return request(`board/${board}/runtimes?${queryParams()}`);
}

export function addRuntime(board, descriptor) {
  return request(`board/${board}/runtimes?${queryParams()}`, 'POST', true, descriptor)
}

export function getServices(board, runtime) {
  return request(`board/${board}/runtime/${runtime}/services?${queryParams()}`);
}

export function addService(board, descriptor) {
  return request(`board/${board}/runtime/${descriptor.runtime}/services?${queryParams()}`, 'PUT', false, descriptor);
}

export function removeService(board, runtimeId, serviceId) {
  return request(`board/${board}/runtime/${runtimeId}/services/${serviceId}?${queryParams()}`, 'DELETE', false);
}

export function clearBoard(board) {
  return request(`board/${board}?${queryParams()}`, 'DELETE', false);
}

export function getRuntimeRegistry(board, runtimeName) {
  return request(`board/${board}/runtime/${runtimeName}/registry?${queryParams()}`);
}

export async function getServiceConfiguration(board, service) {
  return await request(`board/${board}/runtime/${service.__descriptor.runtime}/service/${service.uuid}/config?${queryParams()}`);
}

export function configureService(board, service, config) {
  return request(`board/${board}/runtime/${service.__descriptor.runtime}/service/${service.uuid}/config?${queryParams()}`, 'POST', false, config);
}

export function loadBoard(board, state) {
  return request(`board/${board}?${queryParams()}`, 'PUT', false, state);
}

export function saveBoard(board) {
  return request(`board/${board}?${queryParams()}`, 'GET', true);
}

export function importBoard(board, data) {
  return request(`board/${board}/import?${queryParams()}`, 'POST', true, data);
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

export function detectBrowserIOS() {
  const ua = window.navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  const iOSSafari = iOS && webkit && !ua.match(/CriOS/i);
  return iOSSafari;
}
