import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import MessageReceiver from '../../MessageReceiver';
import { makeQueryString, RequestError } from './helpers';

const serviceId = 'hookup.to/service/spotify';
const serviceName = 'Spotify';

const clientID = 'e91207fc5f2e4a5db1ca562954e4c23e';
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes = ['user-library-read', 'playlist-read-private', 'user-read-recently-played'];

const loginStateId = 'spotify-login';

async function makeRequest(token, url, qp={}) {
  const queryParams = {
    offset: 0,
    limit: 50,
    ...qp,
  };
  const baseURL = 'https://api.spotify.com';
  const fullURL = `${baseURL}${url}?${makeQueryString(queryParams)}`;
  const resp = await fetch(
    fullURL,
    { headers: { 'Authorization': 'Bearer ' + token } },
  );
  if (!resp.ok) {
    throw new RequestError(`GET ${fullURL}`, resp.status)
  }
  return await resp.json();
}


class SpotifyUI extends Component {
  state = {};

  onInit = initialState => {
    const { token } = initialState;
    if (token !== undefined) {
      this.setState({ token });
    }
  }

  onNotification = (service, notification) => {
    const { token } = notification;
    if (token !== undefined) {
      this.setState({ token });
    }
  }

  onLogin = () => {
    const baseURL = 'https://accounts.spotify.com/authorize';
    const state = loginStateId;
    const url = `${baseURL}?client_id=${clientID}&response_type=token&redirect_uri=${encodeURI(redirectURI)}&scope=${scopes.join(',')}&state=${state}`;
    window.open(url, 'blank');
  }

  renderLoginPanel = service => (
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
      onData={data => data.access_token && 
        service.configure({ token: data.access_token })
      }
    />
    </div>
  );

  renderSpotifyPanel = service => (
    <div>
      <Button
        style={s(t.uc, t.ls1, t.fs12)}
        onClick={() => service.configure({ action: 'injectSavedSongs' })}
      >
        Saved songs
      </Button>
    </div>
  )

  renderMain = service => {
    const { token } = this.state;
    return token ?
      this.renderSpotifyPanel(service) : 
      this.renderLoginPanel(service);
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    )
  }
}

class Spotify {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = this.app.restoreServiceData(this.uuid,loginStateId);
  }

  destroy() {
  }

  async getMySavedSongs(n) {
    let finished = false;
    let result = [];
    let offset = 0;
    while (!finished) {
      const limit = n || 50;
      try {
        const songs = await makeRequest(
          this.token, 
          '/v1/me/tracks', { offset, limit }
        );  
        if (songs.items.length > 0) {
          offset += limit;
          result = result.concat(songs.items);
        } else {
          finished = true;
        }
        if (result.length >= n) {
          finished = true;
        }
      } catch (err) {
        switch (err.status) {
          case 401:
            this.app.removeServiceData(this.uuid, loginStateId);
            this.app.notify(this, { token: '' });
            return;
          default:
            console.log('Unhandled error', err);
            return;
        }
      }
    }
    return result;
  }

  async configure(config) { 
    const { 
      token,
      action 
    } = config;
    if (token !== undefined) {
      this.token = token;
      this.app.storeServiceData(this.uuid, loginStateId, token);
      this.app.notify(this, { token });
    }
    if (action !== undefined) {
      switch (action) {
        case 'injectSavedSongs':
          const songs = await this.getMySavedSongs();
          return songs && this.app.next(this, songs);
        default:
          break;
      }
    }
  }

  async process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Spotify(app, board, descriptor, id),
  createUI: SpotifyUI,
};

export default descriptor;
