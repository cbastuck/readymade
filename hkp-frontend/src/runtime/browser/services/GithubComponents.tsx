import { Component } from "react";
import moment from "moment";
import Image from "hkp-frontend/src/ui-components/Image";

import MessageReceiver from "../../../MessageReceiver";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import InputField from "../../../components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import Tree from "../../../components/shared/Tree";
import {
  getUser,
  getRepos,
  getBranches,
  getBranch,
  getTree,
  getAuthURL,
  exchangeCode,
} from "./GithubAPI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

const loginStateId = "github-login";

type User = any;

type UserProps = {
  token: string | undefined;
  size?: string;
  onLogout: () => void;
  onUser: (user: User | null) => void;
};
export class GithubUser extends Component<UserProps, { user: User | null }> {
  state = {
    user: null,
  };

  componentDidMount() {
    const { token } = this.props;
    this.init(token);
  }

  init = async (token: string | undefined) => {
    const user = await getUser(token);
    const { onUser } = this.props;
    if (user) {
      this.setState({ user });
      if (onUser) {
        onUser(user);
      }
    }
  };

  render() {
    const { user } = this.state;
    if (!user) {
      return false;
    }
    const { size = 80, onLogout } = this.props;
    const { login, avatar_url, created_at, public_repos, followers } = user;
    return (
      <div>
        <div className="flex flex-col gap-2 text-left">
          <div className="flex items-start">
            <div className="flex flex-col pr-4">
              <h2>{login}</h2>
              <div className="flex text-left text-md">
                <div>Joined {moment(created_at).format("MM/YYYY")} - </div>
                <div>{public_repos} public repositories - </div>
                <div>{followers} followers</div>
              </div>
            </div>
            <div className="flex flex-col ml-auto">
              <Image className="ml-auto" src={avatar_url} size={size} />
              <Button
                className="ml-auto w-min h-min"
                onClick={() => onLogout && onLogout()}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

type ObjectProps = ServiceUIProps & {
  owner: string;
  repo: any;
  branch: any;
  file: any;
  token: string;
  disableFileInput?: boolean;
  onChange: (diff: Partial<ObjectProps>) => void;
};

type ObjectState = {
  user: User | null;
  owner: string | undefined;
  repos?: any;
  repo: any;
  branches?: any;
  branch: any;
  tree?: any;
  path?: Array<any>;
  fileMode: "New File" | "Select File";
};

export class GithubObject extends Component<ObjectProps, ObjectState> {
  state: ObjectState = {
    path: [],
    user: null,
    owner: undefined,
    repos: undefined,
    repo: undefined,
    branches: undefined,
    branch: undefined,
    tree: undefined,
    fileMode: "New File",
  };

  componentDidMount() {
    this.init();
  }

  componentDidUpdate(prevProps: ObjectProps) {
    const { owner, repo, branch, file } = this.props;
    if (owner !== prevProps.owner) {
      this.onOwnerChanged(owner);
    }

    if (repo !== prevProps.repo) {
      this.onRepoChanged(repo);
    }

    if (branch !== prevProps.branch) {
      this.onBranchChanged(branch);
    }

    if (file !== prevProps.file) {
      this.onFileChanged(file);
    }
  }

  async init() {
    const { token, owner, repo, branch } = this.props;
    const user = await getUser(token);
    const repos = await getRepos(token, owner || user.login);
    const branches = repo
      ? await getBranches(token, owner || user.login, repo)
      : [];
    const tree =
      branch && repo
        ? await getBranch(token, owner || user.login, repo, branch)
        : [];
    this.setState({
      user,
      owner: owner || user.login,
      repos,
      repo,
      branch,
      branches,
      tree,
    });
  }

  onOwnerChanged = async (owner: string) => {
    const { token, onChange } = this.props;
    const repos = await getRepos(token, owner);
    this.setState({
      repos,
      branches: [],
      tree: null,
    });
    onChange({ owner });
  };

  onRepoChanged = async (repo: any) => {
    const { token, owner, branch, onChange } = this.props;
    const branches = await getBranches(token, owner, repo);
    if (branches.find((b: any) => b.name === branch)) {
      // same branch-name exists in new repo
      const tree = await getBranch(token, owner, repo, branch);
      this.setState({
        branches,
        tree,
      });
      onChange({ file: null });
    } else {
      this.setState({
        branches,
        tree: null,
      });
      const first = branches && branches[0];
      onChange({
        branch: first ? first.name : "",
        file: null,
      });
    }
  };

  onBranchChanged = async (branch: string) => {
    const { token, owner, repo, onChange } = this.props;

    this.setState({
      tree: branch ? await getBranch(token, owner, repo, branch) : null,
    });
    onChange({ file: null });
  };

  onFileChanged = async (_file: any) => {};

  renderPanel = () => {
    const { onChange, disableFileInput, branch, repo, file } = this.props; // selections come from props
    const {
      user,
      owner = user ? user.login : "",
      repos,
      branches,
      tree,
      fileMode,
    } = this.state; // options come from state

    if (!repos) {
      return false;
    }

    const repositoryOptions = repos.reduce(
      (all: any, cur: any) => ({ ...all, [cur.name]: cur.name }),
      {}
    );
    const branchOptions = branches
      ? branches.reduce(
          (all: any, cur: any) => ({ ...all, [cur.name]: cur.name }),
          {}
        )
      : {};

    const isFilenameInTree = tree && tree.find((x: any) => x.path === file);
    const fileOptions = ["New File", "Select File"];
    return (
      <div className="flex flex-col text-left">
        <InputField
          label="User"
          value={owner}
          onChange={(owner) => onChange({ owner })}
        />
        <div className="flex">
          <SelectorField
            label="Repo"
            options={repositoryOptions}
            value={repo || ""}
            onChange={({ value: repo }) => onChange({ repo })}
          />
          <SelectorField
            label="Branch"
            options={branchOptions}
            value={branch}
            onChange={({ value: branch }) => onChange({ branch })}
          />
        </div>

        {!disableFileInput && (
          <RadioGroup
            title="File Mode"
            options={fileOptions}
            value={fileMode}
            onChange={async (opt) => {
              this.setState({ fileMode: opt as any });
              if (!isFilenameInTree) {
                onChange({ file: null });
              }
            }}
          />
        )}

        {fileMode === "Select File" || disableFileInput
          ? this.renderFileSelector(file, tree, onChange)
          : this.renderFileInput(file, onChange)}
      </div>
    );
  };

  renderFileTree = (file: any, tree: any, onChange: any) => {
    const { path } = this.state;
    const { token, owner, repo, branch } = this.props;
    const dict: any = {
      blob: "file",
      tree: "folder",
    };
    const items = tree
      ? tree.map((x: any) => ({
          name: x.path,
          type: dict[x.type],
          sha: x.sha,
        }))
      : [];
    return (
      <div className="text-left">
        <Tree
          selected={file && file.name}
          values={items}
          onChange={onChange}
          onExpand={async (folder: any) => {
            const tree = await getTree(token, owner, repo, folder.sha);
            this.setState({
              tree,
              path: path?.concat({ sha: folder.sha, name: folder.name }),
            });
          }}
          onPath={async (part: any) => {
            const pos = path?.findIndex((x) => x.name === part) || -1;
            if (pos !== -1) {
              const tree = await getTree(token, owner, repo, path?.[pos].sha);
              const diff = path ? path.length - 1 - pos : 0;
              if (diff > 0) {
                this.setState({
                  tree,
                  path: path?.slice(0, -diff),
                });
              }
            } else {
              const tree = await getBranch(token, owner, repo, branch);
              this.setState({
                path: [],
                tree,
              });
            }
          }}
          path={path?.map((x) => x.name)}
        />
      </div>
    );
  };

  renderFileSelector = (file: any, tree: any, onChange: any) => {
    const cb = (_ev: any, { selected: filename }: any) => {
      const { path } = this.state;
      const parent = path?.slice(-1)[0];
      const treeSHA = parent ? parent.sha : undefined;
      onChange({
        file: {
          name: filename,
          treeSHA,
        },
      });
    };
    return this.renderFileTree(file, tree, cb);
  };

  renderFileInput = (file: any, onChange: any) => {
    const value = typeof file === "string" ? file : file && file.name;
    return (
      <div className="py-2">
        <SubmittableInput
          fullWidth
          value={value}
          placeholder="New Filename"
          onSubmit={(filename) =>
            onChange({
              file: {
                name: filename,
                treeSHA: null,
              },
            })
          }
        />
      </div>
    );
  };

  render() {
    return this.renderPanel();
  }
}

type AuthProps = {
  onToken: any;
  clientID: any;
  clientSecret: any;
  redirectURI: any;
  scopes: any;
};
export class GithubOAuth extends Component<AuthProps> {
  render() {
    const { onToken, clientID, clientSecret, redirectURI, scopes } = this.props;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Button
          onClick={() => {
            const url = getAuthURL({
              clientID,
              clientSecret,
              scopes,
              redirectURI,
              state: loginStateId,
            });
            if (url) {
              window.open(url, "blank");
            }
          }}
        >
          Login
        </Button>
        <MessageReceiver
          state={loginStateId}
          onData={async (data: any) => {
            const { code } = data;
            if (code) {
              const token = await exchangeCode({
                clientID,
                clientSecret,
                code,
                redirectURI,
              });
              if (token) {
                onToken(token);
              }
            }
          }}
        />
      </div>
    );
  }
}
