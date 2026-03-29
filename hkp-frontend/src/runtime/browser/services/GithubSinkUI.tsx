import { useState } from "react";

import InputField from "../../../components/shared/InputField";
import { GithubUser, GithubObject, GithubOAuth } from "./GithubComponents";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

const clientID = "f2b34053a831baa056e8";
const clientSecret = "";
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes: Array<string> = [];

export default function GithubSinkUI(props: ServiceUIProps) {
  const [token, setToken] = useState<string | null>(null);
  const [owner, setOwner] = useState<any>(undefined);
  const [repo, setRepo] = useState<any>(undefined);
  const [branch, setBranch] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<any>(undefined);
  const [user, setUser] = useState<any>(null);

  const onInit = (initialState: any) => {
    const { token: t, owner: o, repo: r, branch: b, file: f } = initialState;
    setToken(t);
    setOwner(o);
    setRepo(r);
    setBranch(b);
    setFile(f);
  };

  const onNotification = (notification: any) => {
    const { token: t, user: u, owner: o, repo: r, branch: b, file: f } = notification;
    if (t) {
      setToken(t);
    }

    if (u !== undefined) {
      setUser(u);
    }

    if (o !== undefined) {
      setOwner(o);
    }

    if (r !== undefined) {
      setRepo(r);
    }

    if (b !== undefined) {
      setBranch(b);
    }

    if (f !== undefined) {
      setFile(f);
    }
  };

  const renderLoginPanel = () => {
    if (token) {
      return (
        <GithubUser
          token={token}
          onUser={(u) => {
            if (!owner) {
              const o = u.login;
              setOwner(o);
              props.service.configure({ owner: o });
            }
          }}
          onLogout={() => { setOwner(null); setToken(null); }}
        />
      );
    }
    return clientSecret ? (
      <GithubOAuth
        clientID={clientID}
        clientSecret={clientSecret}
        redirectURI={redirectURI}
        scopes={scopes}
        onToken={(t: string) => setToken(t)}
      />
    ) : (
      renderBasicAuth()
    );
  };

  const renderBasicAuth = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <InputField
          label="Token"
          type="password"
          value={token || undefined}
          onChange={(t) => props.service.configure({ token: t })}
        />
      </div>
    );
  };

  const renderObjectSelector = () => {
    if (!token) {
      return false;
    }
    return (
      <GithubObject
        service={props.service}
        onServiceAction={props.onServiceAction}
        token={token}
        owner={owner}
        repo={repo}
        branch={branch}
        file={file || ""}
        onChange={(kv) => props.service.configure(kv)}
      />
    );
  };

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      initialSize={{ width: 400, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
    >
      <>
        {renderLoginPanel()}
        {token && renderObjectSelector()}
      </>
    </ServiceUI>
  );
}
