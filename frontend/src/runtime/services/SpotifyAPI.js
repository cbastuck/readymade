import { makeQueryString, RequestError } from "./helpers";

export function getAuthURL(clientID, redirectURI, scopes, state) {
  const baseURL = "https://accounts.spotify.com/authorize";
  return `${baseURL}?client_id=${clientID}&response_type=token&redirect_uri=${encodeURI(
    redirectURI
  )}&scope=${scopes.join(",")}&state=${state}`;
}

async function makeRequest(token, url, qp) {
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

export function getUserProfile(token) {
  return makeRequest(token, "/v1/me");
}

export async function getRecentSongs(token) {
  const recents = await makeRequest(token, "/v1/me/player/recently-played");
  return recents.items;
}

export async function getMySavedSongs(token, n) {
  let finished = false;
  let result = [];
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
    if (result.length >= n) {
      finished = true;
    }
  }
  return result;
}
