import { useState } from "react";

import { SpotifyOAuth } from "./SpotifyComponents";

import { s, t } from "../../../styles";
import Button from "hkp-frontend/src/ui-components/Button";
import Image from "hkp-frontend/src/ui-components/Image";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

const loginStateId = "spotify-login";

const redirectURI =
  window.location.protocol === "http:"
    ? `http://127.0.0.1:${window.location.port}/serviceRedirect`
    : `${window.location.origin}/serviceRedirect`;

export default function SpotifyUI(props: ServiceUIProps) {
  const [token, setToken] = useState<string | null>(null);
  const [clientID, setClientID] = useState<string>(
    "e91207fc5f2e4a5db1ca562954e4c23e",
  );
  const [profile, setProfile] = useState<{
    display_name: string;
    followers: { total: number };
    images: Array<{ url: string }>;
  } | null>(null);
  const [selectedAction, setSelectedAction] =
    useState<string>("injectSavedSongs");

  const onInit = (initialState: any) => {
    const { token: t, clientID: c } = initialState;
    if (t !== undefined) {
      setToken(t);
    }
    if (c !== undefined) {
      setClientID(c);
    }
  };

  const onNotification = (notification: any) => {
    const { token: t, profile: p, clientID: c } = notification;
    if (t !== undefined) {
      setToken(t);
    }
    if (p !== undefined) {
      setProfile(p);
    }
    if (c !== undefined) {
      setClientID(c);
    }
  };

  const renderUser = (service: ServiceInstance) => {
    if (!token) {
      return (
        <>
          <div style={{ marginBottom: 8 }}>
            <label
              style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
            >
              Client ID
            </label>
            <input
              type="text"
              placeholder="Spotify app Client ID"
              value={clientID}
              onChange={(e) => service.configure({ clientID: e.target.value })}
              style={{
                display: "block",
                width: "100%",
                fontSize: 12,
                padding: "4px 6px",
                border: "1px solid hsl(var(--border))",
                borderRadius: 4,
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
                marginTop: 2,
              }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label
              style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
            >
              Redirect URI (register this in your Spotify app)
            </label>
            <div
              style={{
                fontSize: 11,
                padding: "3px 6px",
                border: "1px solid hsl(var(--border))",
                borderRadius: 4,
                background: "hsl(var(--muted))",
                color: "hsl(var(--foreground))",
                marginTop: 2,
                wordBreak: "break-all",
                cursor: "text",
                userSelect: "all",
              }}
            >
              {redirectURI}
            </div>
          </div>
          <SpotifyOAuth
            clientID={clientID || undefined}
            redirectURI={redirectURI}
            onToken={(t: string) => {
              service.configure({ token: t });
            }}
            state={loginStateId}
          />
        </>
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
