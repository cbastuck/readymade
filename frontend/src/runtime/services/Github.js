import { commit } from './GithubAPI';

export default class Github {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = ''; //this.app.restoreServiceData(this.uuid, loginStateId);
  }

  async configure(config) { 
    const { token } = config;
    if (token !== undefined) {
      this.token = token;
      // this.app.storeServiceData(this.uuid, loginStateId, token);
      this.app.notify(this, { token });
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

  async process(params) {
    if (this.token) {
      return await commit(this.token, params);
    }
  }
}

