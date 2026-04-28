import { makeQueryString, RequestError } from "./helpers";

// PKCE helpers — no backend required, no client secret needed.

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function getAuthURL(
  clientID: string,
  redirectURI: string,
  scopes: string[],
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: clientID,
    response_type: "code",
    redirect_uri: redirectURI,
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectURI: string,
  clientID: string
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectURI,
    client_id: clientID,
    code_verifier: codeVerifier,
  });
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    throw new RequestError("POST /api/token", resp.status);
  }
  const json = await resp.json();
  return json.access_token as string;
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
