import qs from 'querystring';

import {
  logout,
  restoreToken
} from './Auth';
import { serializeObject } from './format';

export function generateQueryParams() {
  const { search='' } = window.location;
  const parsed = qs.parse(search.substr(1));
  if (!parsed) {
    return;
  }
  
  return `?${Object.keys(parsed).map(k => `${k}=${parsed[k]}`).join('&')}`;
}

export async function request(path, method='GET', parseJSON=true, body=undefined, additionalHeaders={}) {
  const { 
    body: serialisedBody, 
    contentType
  } = await serializeObject(body);

  const headers = {
    ...additionalHeaders,
    'Authorization': restoreToken() || '',
  };
  if (contentType && contentType !== 'multipart/form-data') {
    headers['Content-Type'] = contentType;
  }

  const queryParams = (method === 'GET') && generateQueryParams();
  const url = path.absolute ? `${path.absolute}${queryParams ? queryParams : ''}` : `/api/${path}${queryParams ? queryParams : ''}`;
  const response = await fetch(url, {
    method,
    headers,
    body: serialisedBody,
  });
  const status = response.status;
  if (status === 401) {
    logout();
    return;
  }
  if (parseJSON && response.ok) {
    return response.json();
  }
  return response;
}

export function getBoard(board) {
  return request(`board/${board}`)
    .then(res => (res && res.status === 404) ? [] : res);
}

export function getRuntimes(board) {
  return request(`board/${board}/runtimes`)
    .then(res => {
      if (res.ok !== undefined && res.ok === false) {
        return [];
      } 
      return res;
    })
}

export function addRuntime(board, descriptor) {
  return request(`board/${board}/runtimes`, 'POST', true, descriptor);
}

export function removeRuntime(board, runtime) {
  return request(`board/${board}/runtime/${runtime.id}`, 'DELETE', false);
}

export function getServices(board, runtime) {
  return request(`board/${board}/runtime/${runtime}/services`)
    .then(res => (res && res.status === 404) ? [] : res);
}

export function addService(board, descriptor, runtimeId) {
  if (!runtimeId) {
    runtimeId = descriptor.runtime;
  }
  return request(`board/${board}/runtime/${runtimeId}/services`, 'PUT', false, descriptor);
}

export function removeService(board, runtimeId, serviceId) {
  return request(`board/${board}/runtime/${runtimeId}/services/${serviceId}`, 'DELETE', false);
}

export function clearBoard(board) {
  return request(`board/${board}`, 'DELETE', false);
}

export function getRuntimeRegistry(board, runtimeName) {
  return request(`board/${board}/runtime/${runtimeName}/registry`);
}

export async function getServiceConfiguration(boardname, service, runtime=null) {
  const rt = runtime !== null ? runtime.id : service.__descriptor.runtime;
  return await request(`board/${boardname}/runtime/${rt}/service/${service.uuid}/config`);
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

export function shareBoard(board, data) {
  return request(`share/${board}`, 'POST', true, data);
}

export function getShares(board) {
  return request(`share/${board}`, 'GET', true);
}

export function removeShare(board, share) {
  return request(`share/${board}`, 'DELETE', false, share);
}

export function joinBoard(shareId, connectedBoardname) {
  return request(`join/${shareId}`, 'POST', false, { targetBoard: connectedBoardname });
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

export function openTab(url) {
  window.open(url, 'blank');
}

export function detectBrowserIOS() {
  const ua = window && window.navigator && window.navigator.userAgent;
  if (ua) {
    return false;
  }
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  const iOSSafari = iOS && webkit && !ua.match(/CriOS/i);
  return iOSSafari;
}

export function iOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}
