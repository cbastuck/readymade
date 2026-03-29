import { RequestError } from "./helpers";
import { encodeBlobBase64 } from "./helpers";

const baseURL = "https://api.github.com";

async function makeRequest(token: string, url: string): Promise<any> {
  const fullURL = `${baseURL}${url}`;
  const resp = await fetch(fullURL, {
    headers: { Authorization: "token " + token },
  });
  if (!resp.ok) {
    throw new RequestError(fullURL, resp.status);
  }
  return await resp.json();
}

export function getAuthURL({
  clientID,
  clientSecret: _clientSecret,
  scopes,
  redirectURI,
  state,
}: {
  clientID: string;
  clientSecret: string;
  scopes: string[];
  redirectURI: string;
  state: string;
}): string {
  const authBase = "https://github.com/login/oauth/authorize";
  return `${authBase}?client_id=${clientID}&response_type=token&redirect_uri=${encodeURI(
    redirectURI
  )}&scope=${scopes.join(",")}&state=${state}`;
}

export async function exchangeCode({
  clientID,
  clientSecret,
  code,
  redirectURI,
}: {
  clientID: string;
  clientSecret: string;
  code: string;
  redirectURI: string;
}): Promise<any> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    body: JSON.stringify({
      client_id: clientID,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectURI,
    }),
  });
  return response.json();
}

export function getUser(token: string): Promise<any> {
  return makeRequest(token, "/user");
}

export function getRepos(token: string, owner: string): Promise<any> {
  return makeRequest(token, `/users/${owner}/repos`);
}

export function getBranches(
  token: string,
  owner: string,
  repo: string
): Promise<any> {
  return makeRequest(token, `/repos/${owner}/${repo}/branches`);
}

export function getRef(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<any> {
  const ref = `heads/${branch}`;
  return makeRequest(token, `/repos/${owner}/${repo}/git/ref/${ref}`);
}

export async function getBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<any> {
  const head = await getRef(token, owner, repo, branch);
  const { object } = head;
  return getTree(token, owner, repo, object.sha);
}

export async function getTree(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<any> {
  const { tree } = await makeRequest(
    token,
    `/repos/${owner}/${repo}/git/trees/${sha}`
  );
  return tree;
}

export async function createTree(
  token: string,
  owner: string,
  repo: string,
  parentSha: string,
  filename: string,
  blob: any
): Promise<any> {
  const resp = await fetch(`${baseURL}/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github.v3+json",
      Authorization: "token " + token,
    },
    body: JSON.stringify({
      base_tree: parentSha,
      tree: [
        {
          path: filename,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        },
      ],
    }),
  });
  return resp.json();
}

export async function createBlob(
  token: string,
  owner: string,
  repo: string,
  data: Blob | string
): Promise<any> {
  const isBlob = data instanceof Blob;
  const encoding = isBlob ? "base64" : "utf-8";
  const content = isBlob ? await encodeBlobBase64(data) : data;
  const resp = await fetch(`${baseURL}/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github.v3+json",
      Authorization: "token " + token,
    },
    body: JSON.stringify({
      content,
      encoding,
    }),
  });
  return resp.json();
}

export function getBlob(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<any> {
  return makeRequest(token, `/repos/${owner}/${repo}/git/blobs/${sha}`);
}

export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  parentSha: string,
  tree: any,
  message: string
): Promise<any> {
  const resp = await fetch(`${baseURL}/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github.v3+json",
      Authorization: "token " + token,
    },
    body: JSON.stringify({
      message,
      parents: [parentSha],
      tree: tree.sha,
    }),
  });
  return resp.json();
}

export async function updateHead(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  commit: any
): Promise<any> {
  const ref = `heads/${branch}`;
  const resp = await fetch(
    `${baseURL}/repos/${owner}/${repo}/git/refs/${ref}`,
    {
      method: "PATCH",
      headers: {
        accept: "application/vnd.github.v3+json",
        Authorization: "token " + token,
      },
      body: JSON.stringify({
        sha: commit.sha,
      }),
    }
  );
  return resp.json();
}

export async function getFileFromBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filename: string
): Promise<any> {
  const { object } = await getRef(token, owner, repo, branch);
  return getFile(token, owner, repo, object.sha, filename);
}

export async function getFile(
  token: string,
  owner: string,
  repo: string,
  treeSHA: string,
  absoluteFn: string
): Promise<string | undefined> {
  const filename = absoluteFn.split("/").slice(-1)[0];
  const tree = await getTree(token, owner, repo, treeSHA);
  const file = tree && tree.find((x: any) => x.path === filename);
  const blob = file && (await getBlob(token, owner, repo, file.sha));
  if (blob) {
    const { encoding, content } = blob;
    if (encoding === "base64") {
      return atob(content);
    }
    return content;
  }
}

export async function commit(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filename: string,
  data: any,
  message: string
): Promise<any> {
  const ref = await getRef(token, owner, repo, branch);
  const parent = ref.object.sha;
  const blob = await createBlob(token, owner, repo, data);
  const tree = await createTree(token, owner, repo, parent, filename, blob);
  const commitResult = await createCommit(
    token,
    owner,
    repo,
    parent,
    tree,
    message
  );
  const result = await updateHead(token, owner, repo, branch, commitResult);
  return result;
}
