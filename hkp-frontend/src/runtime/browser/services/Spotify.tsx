import SpotifyUI from "./SpotifyUI";

import { getMySavedSongs, getUserProfile, getRecentSongs } from "./SpotifyAPI";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const serviceId = "hookup.to/service/spotify";
const serviceName = "Spotify";

const loginStateId = "spotify-login";
const clientIdStateId = "spotify-client-id";
const clientIDDefault = "e91207fc5f2e4a5db1ca562954e4c23e";

class Spotify {
  uuid: string;
  board: string;
  app: AppInstance;
  token: string | undefined;
  clientID: string | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = this.app.restoreServiceData(this.uuid, loginStateId);
    this.clientID = this.app.restoreServiceData(this.uuid, clientIdStateId) ?? clientIDDefault;
  }

  destroy() {}

  async configure(config: any) {
    const { token, action, clientID } = config;
    if (clientID !== undefined) {
      this.clientID = clientID;
      this.app.storeServiceData(this.uuid, clientIdStateId, clientID);
      this.app.notify(this, { clientID });
    }
    if (token !== undefined) {
      this.token = token;
      this.app.storeServiceData(this.uuid, loginStateId, token);
      this.app.notify(this, { token });
    }
    if (action !== undefined) {
      this.dispatchAction(action);
    }
  }

  onRequestFail = (err: any) => {
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

  async dispatchAction(action: any) {
    const token = this.token;
    if (!token) {
      return false;
    }

    switch (action) {
      case "injectSavedSongs": {
        const liked = await getMySavedSongs(token).catch(this.onRequestFail);
        return liked && this.app.next(this, liked);
      }
      case "injectRecentSongs": {
        const recents = await getRecentSongs(token).catch(this.onRequestFail);
        return recents && this.app.next(this, recents);
      }
      case "getProfile": {
        const profile = await getUserProfile(token).catch(this.onRequestFail);
        this.app.notify(this, { profile });
        break;
      }
      case "logout":
        this.app.removeServiceData(this.uuid, loginStateId);
        break;
      default:
        break;
    }
  }

  async process(params: any) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Spotify(app, board, descriptor, id),
  createUI: SpotifyUI,
};

export default descriptor;
