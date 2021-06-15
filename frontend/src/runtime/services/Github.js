import { makeQueryString, RequestError } from './helpers';

async function makeRequest(token, url, qp={}) {
  const queryParams = { ...qp, };
  const baseURL = 'https://api.github.com';
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

export default class Github {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = ''; //this.app.restoreServiceData(this.uuid, loginStateId);
  }

  async configure(config) { 
    const {
      token,
      action,
    } = config;
    if (token !== undefined) {
      this.token = token;
      // this.app.storeServiceData(this.uuid, loginStateId, token);
      this.app.notify(this, { token });
    }
    
    if (action !== undefined) {
      switch (action) {
        case 'getUser':
          const user = await this.getUser();
          return this.app.notify(this, { user });
        case 'getRepos': 
          const repos = await this.getRepos(config.owner);
          return this.app.notify(this, { repos });
        case 'login':
          return this.getAuthUrl(action);
        case 'exchangeCode':
          return this.exchangeCode(action);
        default:
          break;
      }
    }
  }

  destroy() { }

  getAuthURL({ clientID, clientSecret, scopes, redirectURI, state }) {
    const baseURL = 'https://github.com/login/oauth/authorize';
    return `${baseURL}?client_id=${clientID}&response_type=token&redirect_uri=${encodeURI(redirectURI)}&scope=${scopes.join(',')}&state=${state}`;
  }

  exchangeCode({ clientID, clientSecret, code, redirectURI}) {
    fetch(
      'https://github.com/login/oauth/access_token',
      { 
        method: 'POST',
        body: JSON.stringify({
          client_id: clientID,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectURI,
        })
      }
    );
  }

  async getUser(n) {
    return await makeRequest(
      this.token, 
      '/user',
    );
  }

  getRepos(owner) {
    return makeRequest(this.token, `/users/${owner}/repos`);
  }

  async commit(params) {
    // http://www.levibotelho.com/development/commit-a-file-with-the-github-api/
    const baseURL = 'https://api.github.com';

    const repo = 'hkp';
    const owner = 'cbastuck';
    const branch = 'master';
    const ref = `heads/${branch}`;
    const refURL = `/repos/${owner}/${repo}/git/ref/${ref}`;
    const filename = 'spotify.json';

    let resp = await makeRequest(this.token, refURL);

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
          Authorization: 'token ' + this.token,
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
          Authorization: 'token ' + this.token,
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
          Authorization: 'token ' + this.token,
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
          Authorization: 'token ' + this.token,
        },
        body: JSON.stringify({
          sha: commitSHA,
        })
      }
    );
    resp = await resp.json();     
  }

  async process(params) {
    return await this.commit(params);
  }
}

