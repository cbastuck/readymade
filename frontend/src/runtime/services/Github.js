import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import MessageReceiver from '../../MessageReceiver';
import { makeQueryString, RequestError } from './helpers';

const serviceId = 'hookup.to/service/github';
const serviceName = 'Github';

const clientID = 'f2b34053a831baa056e8';
const clientSecret = '';
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes = [];
const loginStateId = 'github-login';

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


class GithubUI extends Component {
  state = {};

  onInit = initialState => {
    const { 
      token,
    } = initialState;
    this.setState({ token });
  }

  onNotification = (service, notification) => {
    const { token } = notification;
    if (token) {
      this.setState({ token });
    }
  }

  onLogin = () => {
    const baseURL = 'https://github.com/login/oauth/authorize';
    const state = loginStateId;
    const url = `${baseURL}?client_id=${clientID}&response_type=token&redirect_uri=${encodeURI(redirectURI)}&scope=${scopes.join(',')}&state=${state}`;
    window.open(url, 'blank');
  }

  renderLoginPanel = service => 
    clientSecret ? 
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Button
          style={s(t.uc, t.ls1, t.fs12)}
          onClick={this.onLogin}
        >
        Login
      </Button>
      <MessageReceiver
        state={loginStateId}
        onData={async data => {
          const { code } = data;
          if (code) {
            fetch(
              'https://github.com/login/oauth/access_token',
              { 
                method: 'POST',
                body: JSON.stringify({
                  client_id: clientID,
                  client_secret: clientSecret,
                  code: data.code,
                  redirect_uri: redirectURI,
                })
              }
            );
            data.access_token && 
            service.configure({ token: data.access_token })
          }
        }}
      />
      </div>
    ) : 
    this.renderBasicAuth()
    

  renderGithubPanel = service => (
    <div>
      <Button
        style={s(t.uc, t.ls1, t.fs12)}
        onClick={() => service.configure({ action: 'getUser' })}
      >
        Get User
      </Button>
    </div>
  )

  renderBasicAuth = service => {
    const { token } = this.state;
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <InputField 
          label="Token"
          value={token}
          onChange={(_, { value: token }) => 
            service.configure({ token })
          }
        />
      </div>
    )
  }

  render() {
    const { token } = this.state;
    const segments=[
      { name: 'Login', render: this.renderLoginPanel },
      { name: 'Github', render: this.renderGithubPanel, disabled: !token },
    ];
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={segments}
      />
    )
  }
}

class Github {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = ''; //this.app.restoreServiceData(this.uuid, loginStateId);
  }

  destroy() {
  }

  async getUser(n) {
    return await makeRequest(
      this.token, 
      '/user',
    );
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
          return this.app.next(this, user);
        default:
          break;
      }
    }
  }

  async process(params) {
    return await this.commit(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Github(app, board, descriptor, id),
  createUI: GithubUI,
};

export default descriptor;
