import { Component } from "react";

import { SpotifyOAuth } from "./SpotifyComponents";

import { s, t } from "../../../styles";
import Button from "hkp-frontend/src/ui-components/Button";
import Image from "hkp-frontend/src/ui-components/Image";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

const loginStateId = "spotify-login";

type State = {
  token: string | null;
  profile: {
    display_name: string;
    followers: { total: number };
    images: Array<{ url: string }>;
  } | null;
  selectedAction: string;
};

export default class SpotifyUI extends Component<ServiceUIProps, State> {
  state: State = {
    token: null,
    profile: null,
    selectedAction: "injectSavedSongs",
  };

  onInit = (initialState: any) => {
    const { token } = initialState;
    if (token !== undefined) {
      this.setState({ token });
    }
  };

  onNotification = (notification: any) => {
    const { token, profile } = notification;
    if (token !== undefined) {
      this.setState({ token });
    }

    if (profile !== undefined) {
      this.setState({ profile });
    }
  };

  renderUser = (service: ServiceInstance) => {
    const { token, profile } = this.state;
    if (!token) {
      return (
        <SpotifyOAuth
          onToken={(token: string) => {
            service.configure({ token });
          }}
          state={loginStateId}
        />
      );
    }

    if (!profile) {
      service.configure({ action: "getProfile" });
      return <div style={s(t.ls1, t.fs12)}>Loading profile</div>;
    }
    const { display_name: name, images: allImages } = profile;
    const image = allImages[0];
    return (
      <div className="mb-4">
        <div className="flex flex-col">
          {image && (
            <div style={s(t.tc, t.w100, t.p10)}>
              <Image src={image.url} size={400} />
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-evenly">
          <div>{name}</div>
          <Button
            size="xs"
            className="px-2"
            onClick={() => {
              service.configure({ action: "logout" });
              this.setState({ token: null });
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    );
  };

  renderActions = (service: ServiceInstance) => {
    const { selectedAction } = this.state;
    const actions = {
      injectSavedSongs: "Get liked songs",
      injectRecentSongs: "Get recent songs",
    };
    return (
      <div>
        <RadioGroup
          title="Actions"
          options={actions}
          value={this.state.selectedAction}
          onChange={(newAction) => this.setState({ selectedAction: newAction })}
        />

        <Button
          style={s(t.ls1, t.fs12, t.w100, t.mt5)}
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
        initialSize={{ width: 300, height: undefined }}
        className="pb-2"
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
      >
        <>
          {this.renderUser(this.props.service)}
          {this.state.token && this.renderActions(this.props.service)}
        </>
      </ServiceUI>
    );
  }
}
