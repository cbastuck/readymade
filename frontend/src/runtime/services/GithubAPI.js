import { RequestError } from "./helpers";
import { encodeBlobBase64 } from "./helpers";

const baseURL = "https://api.github.com";

async function makeRequest(token, url) {
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
  clientSecret,
  scopes,
  redirectURI,
  state,
}) {
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
}) {
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

export function getUser(token) {
  return makeRequest(token, "/user");
}

export function getRepos(token, owner) {
  return makeRequest(token, `/users/${owner}/repos`);
}

export function getBranches(token, owner, repo) {
  return makeRequest(token, `/repos/${owner}/${repo}/branches`);
}

export function getRef(token, owner, repo, branch) {
  const ref = `heads/${branch}`;
  return makeRequest(token, `/repos/${owner}/${repo}/git/ref/${ref}`);
}

export async function getBranch(token, owner, repo, branch) {
  const head = await getRef(token, owner, repo, branch);
  const { object } = head;
  return getTree(token, owner, repo, object.sha);
}

export async function getTree(token, owner, repo, sha) {
  const { tree } = await makeRequest(
    token,
    `/repos/${owner}/${repo}/git/trees/${sha}`
  );
  return tree;
}

export async function createTree(
  token,
  owner,
  repo,
  parentSha,
  filename,
  blob
) {
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

export async function createBlob(token, owner, repo, data) {
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

export function getBlob(token, owner, repo, sha) {
  return makeRequest(token, `/repos/${owner}/${repo}/git/blobs/${sha}`);
}

export async function createCommit(
  token,
  owner,
  repo,
  parentSha,
  tree,
  message
) {
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

export async function updateHead(token, owner, repo, branch, commit) {
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

export async function getFileFromBranch(token, owner, repo, branch, filename) {
  const { object } = await getRef(token, owner, repo, branch);
  return getFile(token, owner, repo, object.sha, filename);
}

export async function getFile(token, owner, repo, treeSHA, absoluteFn) {
  const filename = absoluteFn.split("/").slice(-1)[0];
  const tree = await getTree(token, owner, repo, treeSHA);
  const file = tree && tree.find((x) => x.path === filename);
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
  token,
  owner,
  repo,
  branch,
  filename,
  data,
  message
) {
  const ref = await getRef(token, owner, repo, branch);
  const parent = ref.object.sha;
  const blob = await createBlob(token, owner, repo, data);
  const tree = await createTree(token, owner, repo, parent, filename, blob);
  const commit = await createCommit(token, owner, repo, parent, tree, message);
  const result = await updateHead(token, owner, repo, branch, commit);
  return result;
}
