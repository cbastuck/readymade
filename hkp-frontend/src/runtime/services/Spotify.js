import React, { Component } from "react";
import { Button, Card, Icon, Image } from "semantic-ui-react";

import ServiceUI from "./ServiceUI";
import { s, t } from "../../styles";
import SelectorField from "../../components/shared/SelectorField";
import { SpotifyOAuth } from "./SpotifyComponents";
import { getMySavedSongs, getUserProfile, getRecentSongs } from "./SpotifyAPI";

const serviceId = "hookup.to/service/spotify";
const serviceName = "Spotify";

const loginStateId = "spotify-login";

class SpotifyUI extends Component {
  state = {
    selectedAction: "injectSavedSongs",
  };

  onInit = (initialState) => {
    const { token } = initialState;
    if (token !== undefined) {
      this.setState({ token });
    }
  };

  onNotification = (service, notification) => {
    const { token, profile } = notification;
    if (token !== undefined) {
      this.setState({ token });
    }

    if (profile !== undefined) {
      this.setState({ profile });
    }
  };

  renderUser = (service) => {
    const { token, profile } = this.state;
    if (!token) {
      return (
        <SpotifyOAuth
          onToken={(token) => service.configure({ token })}
          state={loginStateId}
        />
      );
    }

    if (!profile) {
      service.configure({ action: "getProfile" });
      return <div style={s(t.uc, t.ls1, t.fs12)}>Loading profile</div>;
    }
    const { display_name: name, followers, images: allImages } = profile;
    const image = allImages[0];
    return (
      <div style={s(t.uc, t.fs12, t.ls1)}>
        <Card>
          {image && (
            <div style={s(t.tc, t.w100, t.p10)}>
              <Image
                style={{
                  width: 160,
                  height: 150,
                  overflow: "hidden",
                  margin: "auto",
                }}
                src={image.url}
                circular
              />
            </div>
          )}
          <Card.Content>
            <Card.Header>{name}</Card.Header>
          </Card.Content>
          <Card.Content extra>
            <Icon name="user" />
            Followers {followers.total}
          </Card.Content>
        </Card>
        <Button style={s(t.uc, t.fs12, t.ls1, t.w100)} onClick={() => {}}>
          Logout
        </Button>
      </div>
    );
  };

  renderActions = (service) => {
    const { selectedAction } = this.state;
    const actions = {
      injectSavedSongs: "Get liked songs",
      injectRecentSongs: "Get recent songs",
    };
    return (
      <div>
        <SelectorField
          label="Action"
          options={actions}
          value={selectedAction}
          onChange={(_, { value: selectedAction }) =>
            this.setState({ selectedAction })
          }
        />
        <Button
          style={s(t.uc, t.ls1, t.fs12, t.w100)}
          onClick={() => service.configure({ action: selectedAction })}
        >
          Do it
        </Button>
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={[
          { name: "User", render: this.renderUser },
          { name: "Actions", render: this.renderActions },
        ]}
      />
    );
  }
}

class Spotify {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = this.app.restoreServiceData(this.uuid, loginStateId);
  }

  destroy() {}

  async configure(config) {
    const { token, action } = config;
    if (token !== undefined) {
      this.token = token;
      this.app.storeServiceData(this.uuid, loginStateId, token);
      this.app.notify(this, { token });
    }
    if (action !== undefined) {
      this.dispatchAction(action);
    }
  }

  onRequestFail = (err) => {
    switch (err.status) {
      case 401:
        this.token = "";
        this.app.removeServiceData(this.uuid, loginStateId);
        this.app.notify(this, { token: "" });
        return;
      default:
        console.log("Unhandled error", err);
        return;
    }
  };

  async dispatchAction(action) {
    switch (action) {
      case "injectSavedSongs":
        const liked = await getMySavedSongs(this.token).catch(
          this.onRequestFail
        );
        return liked && this.app.next(this, liked);
      case "injectRecentSongs":
        const recents = await getRecentSongs(this.token).catch(
          this.onRequestFail
        );
        return recents && this.app.next(this, recents);
      case "getProfile":
        const profile = await getUserProfile(this.token).catch(
          this.onRequestFail
        );
        this.app.notify(this, { profile });
        break;
      default:
        break;
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
