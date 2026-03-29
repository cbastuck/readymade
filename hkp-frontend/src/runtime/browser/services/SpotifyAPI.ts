import { makeQueryString, RequestError } from "./helpers";

export function getAuthURL(
  clientID: string,
  redirectURI: string,
  scopes: string[],
  state: string
): string {
  const baseURL = "https://accounts.spotify.com/authorize";
  return `${baseURL}?client_id=${clientID}&response_type=token&redirect_uri=${encodeURI(
    redirectURI
  )}&scope=${scopes.join(",")}&state=${state}`;
}

async function makeRequest(
  token: string,
  url: string,
  qp?: Record<string, any>
): Promise<any> {
  const baseURL = "https://api.spotify.com";
  const fullURL = `${baseURL}${url}${qp ? "?" + makeQueryString(qp) : ""}`;
  const resp = await fetch(fullURL, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!resp.ok) {
    throw new RequestError(`GET ${fullURL}`, resp.status);
  }
  return await resp.json();
}

export function getUserProfile(token: string): Promise<any> {
  return makeRequest(token, "/v1/me");
}

export async function getRecentSongs(token: string): Promise<any[]> {
  const recents = await makeRequest(token, "/v1/me/player/recently-played");
  return recents.items;
}

export async function getMySavedSongs(
  token: string,
  n?: number
): Promise<any[]> {
  let finished = false;
  let result: any[] = [];
  let offset = 0;
  while (!finished) {
    const limit = n || 50;
    const songs = await makeRequest(token, "/v1/me/tracks", { offset, limit });
    if (songs.items.length > 0) {
      offset += limit;
      result = result.concat(songs.items);
    } else {
      finished = true;
    }
    if (n && result.length >= n) {
      finished = true;
    }
  }
  return result;
}
