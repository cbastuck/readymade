import SpotifyUI from "./SpotifyUI";

import { getMySavedSongs, getUserProfile, getRecentSongs } from "./SpotifyAPI";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const serviceId = "hookup.to/service/spotify";
const serviceName = "Spotify";

const loginStateId = "spotify-login";

class Spotify {
  uuid: string;
  board: string;
  app: AppInstance;
  token: string | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = this.app.restoreServiceData(this.uuid, loginStateId);
  }

  destroy() {}

  async configure(config: any) {
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
    switch (action) {
      case "injectSavedSongs": {
        const liked = await getMySavedSongs(this.token).catch(
          this.onRequestFail
        );
        return liked && this.app.next(this, liked);
      }
      case "injectRecentSongs": {
        const recents = await getRecentSongs(this.token).catch(
          this.onRequestFail
        );
        return recents && this.app.next(this, recents);
      }
      case "getProfile": {
        const profile = await getUserProfile(this.token).catch(
          this.onRequestFail
        );
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
    id: string
  ) => new Spotify(app, board, descriptor, id),
  createUI: SpotifyUI,
};

export default descriptor;
