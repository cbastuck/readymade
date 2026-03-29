import { useState } from "react";

import { SpotifyOAuth } from "./SpotifyComponents";

import { s, t } from "../../../styles";
import Button from "hkp-frontend/src/ui-components/Button";
import Image from "hkp-frontend/src/ui-components/Image";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

const loginStateId = "spotify-login";

export default function SpotifyUI(props: ServiceUIProps) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    display_name: string;
    followers: { total: number };
    images: Array<{ url: string }>;
  } | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("injectSavedSongs");

  const onInit = (initialState: any) => {
    const { token: t } = initialState;
    if (t !== undefined) {
      setToken(t);
    }
  };

  const onNotification = (notification: any) => {
    const { token: t, profile: p } = notification;
    if (t !== undefined) {
      setToken(t);
    }

    if (p !== undefined) {
      setProfile(p);
    }
  };

  const renderUser = (service: ServiceInstance) => {
    if (!token) {
      return (
        <SpotifyOAuth
          onToken={(t: string) => {
            service.configure({ token: t });
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
              setToken(null);
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    );
  };

  const renderActions = (service: ServiceInstance) => {
    const actions = {
      injectSavedSongs: "Get liked songs",
      injectRecentSongs: "Get recent songs",
    };
    return (
      <div>
        <RadioGroup
          title="Actions"
          options={actions}
          value={selectedAction}
          onChange={(newAction) => setSelectedAction(newAction)}
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

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 300, height: undefined }}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      <>
        {renderUser(props.service)}
        {token && renderActions(props.service)}
      </>
    </ServiceUI>
  );
}
