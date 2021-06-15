import { makeQueryString, RequestError } from './helpers';

const baseURL = 'https://api.github.com';

async function makeRequest(token, url, qp={}) {
  const queryParams = { ...qp, };
  const fullURL = `${baseURL}${url}?${makeQueryString(queryParams)}`;
  const resp = await fetch(
    fullURL,
    { headers: { 'Authorization': 'token ' + token } },
  );
  if (!resp.ok) {
    throw new RequestError(fullURL, resp.status);
  }
  return await resp.json();
}

export async function getUser(token) {
    return await makeRequest(token, '/user');
  }

export async function getRepos(token, owner) {
    return makeRequest(token, `/users/${owner}/repos`);
  }

export async function getBranches(token, owner, repo) {
    return makeRequest(token, `/repos/${owner}/${repo}/branches`);
  }

export async function getTree(token, owner, repo, branch) {
    const ref = `heads/${branch}`;
    const { object } = await makeRequest(token,  `/repos/${owner}/${repo}/git/ref/${ref}`);

    const { tree } = await makeRequest(token, `/repos/${owner}/${repo}/git/trees/${object.sha}`);
    return tree;
  }

export async function commit(token, params) {
    // http://www.levibotelho.com/development/commit-a-file-with-the-github-api/
    const repo = 'hkp';
    const owner = 'cbastuck';
    const filename = 'spotify.json';

    const branch = 'master';
    const ref = `heads/${branch}`;
    const refURL = `/repos/${owner}/${repo}/git/ref/${ref}`;
    let resp = await makeRequest(token, refURL);

    const { url: headURL, sha: headSHA } = resp.object;
    resp = await fetch(headURL);
    resp = await resp.json();
    
    const { sha: headSHA2, tree } = resp;
    const { sha: treeSHA, url: treeURL } = tree;

    resp = await fetch(
      `${baseURL}/repos/${owner}/${repo}/git/blobs`,
      { 
        method: 'POST',
        headers: { 
          accept: 'application/vnd.github.v3+json',
          Authorization: 'token ' + token,
        },
        body: JSON.stringify({
          'content': JSON.stringify(params)
        })
      }
    );
    resp = await resp.json();
    const { sha: blobSHA, url: blobURL } = resp;

/*
    resp = await fetch(treeURL);
    resp = await resp.json();
    console.log('TREE GET', resp);
*/


    resp = await fetch(
      `${baseURL}/repos/${owner}/${repo}/git/trees`,
      { 
        method: 'POST',
        headers: { 
          accept: 'application/vnd.github.v3+json',
          Authorization: 'token ' + token,
        },
        body: JSON.stringify({
          'base_tree': treeSHA,
          tree: [
            {
              'path': filename,
              'mode': '100644',
              'type': 'blob',
              'sha': blobSHA,
            }
          ]
        })
      }
    );
    resp = await resp.json();
    const { sha: createdTreeSHA, url: createdTreeURL } = resp;

   
    resp = await fetch(
      `${baseURL}/repos/${owner}/${repo}/git/commits`,
      { 
        method: 'POST',
        headers: { 
          accept: 'application/vnd.github.v3+json',
          Authorization: 'token ' + token,
        },
        body: JSON.stringify({
          message: 'commit message',
          parents: [headSHA],
          tree: createdTreeSHA
        })
      }
    );
    resp = await resp.json(); 
    const { sha: commitSHA, url: commitURL } = resp;

    resp = await fetch(
      `${baseURL}/repos/${owner}/${repo}/git/refs/${ref}`,
      { 
        method: 'PATCH',
        headers: { 
          accept: 'application/vnd.github.v3+json',
          Authorization: 'token ' + token,
        },
        body: JSON.stringify({
          sha: commitSHA,
        })
      }
    );
    resp = await resp.json();     
  }
