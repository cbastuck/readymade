import { serializeObject } from "./format";

type AbsoluteURL = { absolute: string };
type RequestPath = string | AbsoluteURL;

function restoreToken(): string | undefined {
  throw new Error("This functionality does not exist anymore: restoreToken()");
}

function logout(): void {
  throw new Error("This functionality does not exist anymore: logout()");
}

export function generateQueryParams(): string {
  const { search = "" } = window.location;
  const parsed = Object.fromEntries(new URLSearchParams(search.substr(1)));

  return `?${Object.keys(parsed)
    .map((k) => `${k}=${parsed[k]}`)
    .join("&")}`;
}

export async function request(
  path: RequestPath,
  method: string = "GET",
  parseJSON: boolean = true,
  body: any = undefined,
  additionalHeaders: Record<string, string> = {}
): Promise<any> {
  const { body: serialisedBody, contentType } = await serializeObject(body);

  const headers: Record<string, string> = { ...additionalHeaders };
  const token = restoreToken();
  if (token) {
    headers["Authorization"] = token;
  }

  // multipart form content type contains the boundary which is generated automatically
  if (contentType && contentType !== "multipart/form-data") {
    headers["Content-Type"] = contentType;
  }

  const queryParams = method === "GET" && generateQueryParams();
  const url =
    (path as AbsoluteURL).absolute
      ? `${(path as AbsoluteURL).absolute}${queryParams ? queryParams : ""}`
      : `/api/${path}${queryParams ? queryParams : ""}`;
  const response = await fetch(url, {
    method,
    headers,
    body: serialisedBody as BodyInit,
  });

  const status = response.status;
  if (status === 401) {
    logout();
    throw new Error("Unauthorized");
  }

  if (parseJSON && response.ok) {
    return response.json();
  }
  return response;
}

export function getBoard(board: string): Promise<any> {
  return request(`board/${board}`).then((res) =>
    res && res.status === 404 ? [] : res
  );
}

export function getRuntimes(board: string): Promise<any> {
  return request(`board/${board}/runtimes`).then((res: any) => {
    if (!res || (res.ok !== undefined && res.ok === false)) {
      return [];
    }
    return res;
  });
}

export function addRuntime(board: string, descriptor: any): Promise<any> {
  const { url: remoteUrl } = descriptor;
  const url = remoteUrl
    ? { absolute: `${remoteUrl}/board/${board}/runtimes` }
    : `board/${board}/runtimes`;
  return request(url, "POST", true, descriptor);
}

export function setRuntime(
  board: string,
  descriptor: any,
  services: any
): Promise<any> {
  const { url: remoteUrl } = descriptor;
  const url = remoteUrl
    ? { absolute: `${remoteUrl}/board/${board}/runtimes` }
    : `board/${board}/runtimes`;
  return request(url, "PUT", false, { ...descriptor, services });
}

export function removeRuntime(board: string, runtime: { id: string }): Promise<any> {
  return request(`board/${board}/runtime/${runtime.id}`, "DELETE", false);
}

export function getServices(board: string, runtime: string): Promise<any> {
  return request(`board/${board}/runtime/${runtime}/services`).then((res) =>
    res && res.status === 404 ? [] : res
  );
}

export function addService(
  board: string,
  descriptor: any,
  runtimeId?: string
): Promise<any> {
  if (!runtimeId) {
    runtimeId = descriptor.runtime;
  }
  return request(
    `board/${board}/runtime/${runtimeId}/services`,
    "PUT",
    false,
    descriptor
  );
}

export function removeService(
  board: string,
  runtimeId: string,
  serviceId: string
): Promise<any> {
  return request(
    `board/${board}/runtime/${runtimeId}/services/${serviceId}`,
    "DELETE",
    false
  );
}

export function clearBoard(board: string): Promise<any> {
  return request(`board/${board}`, "DELETE", false);
}

export function getRuntimeRegistry(board: string, runtimeId: string): Promise<any> {
  return request(`board/${board}/runtime/${runtimeId}/registry`);
}

export async function getServiceConfiguration(
  boardname: string,
  service: any,
  runtime?: any
): Promise<any> {
  const rt = !!runtime ? runtime.id : service.__descriptor.runtime;
  return await request(
    `board/${boardname}/runtime/${rt}/service/${service.uuid}/config`
  );
}

export function configureService(
  board: string,
  service: any,
  config: any,
  descriptor: any
): Promise<any> {
  const { url: remoteUrl, id: runtimeId } = descriptor;
  const rt = descriptor ? runtimeId : service.__descriptor.runtime;
  const url = remoteUrl
    ? {
        absolute: `${remoteUrl}/board/${board}/runtime/${rt}/service/${service.uuid}/config`,
      }
    : `board/${board}/runtime/${rt}/service/${service.uuid}/config`;
  return request(url, "POST", false, config);
}

export function loadBoard(board: string, state: any): Promise<any> {
  return request(`board/${board}`, "PUT", false, state);
}

export function saveBoard(board: string): Promise<any> {
  return request(`board/${board}`, "GET", true);
}

export function importBoard(board: string, data: any): Promise<any> {
  return request(`board/${board}/import`, "POST", true, data);
}

export function shareBoard(board: string, data: any): Promise<any> {
  return request(`share/${board}`, "POST", true, data);
}

export function getShares(board: string): Promise<any> {
  return request(`share/${board}`, "GET", true);
}

export function removeShare(board: string, share: any): Promise<any> {
  return request(`share/${board}`, "DELETE", false, share);
}

export function joinBoard(
  shareId: string,
  connectedBoardname: string
): Promise<any> {
  return request(`join/${shareId}`, "POST", false, {
    targetBoard: connectedBoardname,
  });
}

export function redirectUri(): string {
  //return `${window.location.protocol}//${window.location.host}/auth2app`;
  return `${window.location.protocol}//${window.location.host}/openid/hkp-redirect`;
}

export function redirectTo(target: string, openAsPopup?: boolean): boolean {
  if (openAsPopup) {
    window.open(target, "login-popup", "width=450,height=430");
  } else {
    window.location.href = target;
  }
  return false;
}

export function openTab(url: string): void {
  window.open(url, "blank");
}
