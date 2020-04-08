import qs from 'querystring';

import {
  removeToken,
  restoreToken
} from './Auth';

let pendingLoginRequest = null;

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

  const createBlobKey = key => `raw-blob-data-@${key}`;
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
  return request(`board/${board}/runtimes`, 'POST', true, descriptor)
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

export function loadBoard(board, state) {
  return request(`board/${board}`, 'PUT', false, state);
}

export function saveBoard(board) {
  return request(`board/${board}`, 'GET', true);
}

export function importBoard(board, data) {
  return request(`board/${board}/import`, 'POST', true, data);
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

export function redirectToLogin(board) {
  if (pendingLoginRequest) {
    return;
  }
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