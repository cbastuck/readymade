import { Component } from "react";

import InputField from "../../../components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import { GithubUser, GithubObject, GithubOAuth } from "./GithubComponents";
import { getFile, getFileFromBranch } from "./GithubAPI";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";

const clientID = "f2b34053a831baa056e8";
const clientSecret = "";
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes: Array<string> = [];

type State = {
  token: string | null;
  owner: any;
  repo: any;
  branch: string | undefined;
  file: any;
  user: any;
};
export default class GithubSourceUI extends Component<ServiceUIProps, State> {
  state: State = {
    token: null,
    owner: undefined,
    repo: undefined,
    branch: undefined,
    file: undefined,
    user: null,
  };

  onInit = (initialState: any) => {
    const { token, owner, repo, branch, file } = initialState;
    this.setState({ token, owner, repo, branch, file });
  };

  onNotification = (notification: any) => {
    const { token, user, owner, repo, branch, file } = notification;
    if (token) {
      this.setState({ token });
    }

    if (user !== undefined) {
      this.setState({ user });
    }

    if (owner !== undefined) {
      this.setState({ owner });
    }

    if (repo !== undefined) {
      this.setState({ repo });
    }

    if (branch !== undefined) {
      this.setState({ branch });
    }

    if (file !== undefined) {
      this.setState({ file });
    }
  };

  renderLoginPanel = () => {
    const { token } = this.state;
    if (token) {
      return (
        <GithubUser
          token={token}
          onUser={(user) => {
            if (!this.state.owner) {
              const owner = user.login;
              this.setState({ owner });
              this.props.service.configure({ owner });
            }
          }}
          onLogout={() => this.setState({ owner: null })}
        />
      );
    }
    return clientSecret ? (
      <GithubOAuth
        clientID={clientID}
        clientSecret={clientSecret}
        redirectURI={redirectURI}
        scopes={scopes}
        onToken={(token: string) => this.setState({ token })}
      />
    ) : (
      this.renderBasicAuth()
    );
  };

  renderBasicAuth = () => {
    const { token } = this.state;
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <InputField
          label="Token"
          type="password"
          value={token || undefined}
          onChange={(token) => this.props.service.configure({ token })}
        />
      </div>
    );
  };

  renderObjectSelector = () => {
    const { token, owner, repo, branch, file } = this.state;
    if (!token) {
      return false;
    }
    return (
      <div>
        <GithubObject
          service={this.props.service}
          onServiceAction={this.props.onServiceAction}
          token={token}
          owner={owner}
          repo={repo}
          branch={branch}
          file={file || ""}
          disableFileInput={true}
          onChange={(kv) => this.props.service.configure(kv)}
        />
        <Button
          className="w-full mt-2"
          onClick={() => this.inject()}
          disabled={!file}
        >
          Inject
        </Button>
      </div>
    );
  };

  inject = async () => {
    const { token, owner, repo, file, branch } = this.state;
    const content = file.treeSHA
      ? await getFile(token, owner, repo, file.treeSHA, file.name)
      : await getFileFromBranch(token, owner, repo, branch, file.name);
    if (content) {
      this.props.service.inject(content);
    }
  };

  render() {
    const { token } = this.state;
    return (
      <ServiceUI
        {...this.props}
        className="pb-2"
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        <>
          {this.renderLoginPanel()}
          {token && this.renderObjectSelector()}
        </>
      </ServiceUI>
    );
  }
}
