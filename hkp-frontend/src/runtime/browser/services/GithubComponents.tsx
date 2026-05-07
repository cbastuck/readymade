import { useState, useEffect } from "react";
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
export function GithubUser(props: UserProps) {
  const { token, size = 80, onLogout, onUser } = props;
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    init(token);
  }, [token]);

  const init = async (t: string | undefined) => {
    if (!t) {
      setUser(null);
      return;
    }
    const u = await getUser(t);
    if (u) {
      setUser(u);
      if (onUser) {
        onUser(u);
      }
    }
  };

  if (!user) {
    return false;
  }
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
              className="hkp-svc-btn ml-auto w-min h-min"
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

type ObjectProps = ServiceUIProps & {
  owner: string;
  repo: any;
  branch: any;
  file: any;
  token: string;
  disableFileInput?: boolean;
  onChange: (diff: Partial<ObjectProps>) => void;
};

export function GithubObject(props: ObjectProps) {
  const { token, owner, repo, branch, file, onChange, disableFileInput } =
    props;

  const [user, setUser] = useState<User | null>(null);
  const [ownerState, setOwnerState] = useState<string | undefined>(undefined);
  const [repos, setRepos] = useState<any>(undefined);
  const [branches, setBranches] = useState<any>(undefined);
  const [tree, setTree] = useState<any>(undefined);
  const [path, setPath] = useState<Array<any>>([]);
  const [fileMode, setFileMode] = useState<"New File" | "Select File">(
    "New File",
  );

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (ownerState !== undefined && owner !== ownerState) {
      onOwnerChanged(owner);
    }
  }, [owner]);

  useEffect(() => {
    onRepoChanged(repo);
  }, [repo]);

  useEffect(() => {
    onBranchChanged(branch);
  }, [branch]);

  useEffect(() => {
    onFileChanged(file);
  }, [file]);

  const init = async () => {
    const u = await getUser(token);
    const r = await getRepos(token, owner || u.login);
    const b = repo ? await getBranches(token, owner || u.login, repo) : [];
    const t =
      branch && repo
        ? await getBranch(token, owner || u.login, repo, branch)
        : [];
    setUser(u);
    setOwnerState(owner || u.login);
    setRepos(r);
    setBranches(b);
    setTree(t);
  };

  const onOwnerChanged = async (o: string) => {
    const r = await getRepos(token, o);
    setRepos(r);
    setBranches([]);
    setTree(null);
    onChange({ owner: o });
  };

  const onRepoChanged = async (r: any) => {
    if (!token || !owner) return;
    const b = await getBranches(token, owner, r);
    if (b && b.find((bItem: any) => bItem.name === branch)) {
      // same branch-name exists in new repo
      const t = await getBranch(token, owner, r, branch);
      setBranches(b);
      setTree(t);
      onChange({ file: null });
    } else {
      setBranches(b);
      setTree(null);
      const first = b && b[0];
      onChange({
        branch: first ? first.name : "",
        file: null,
      });
    }
  };

  const onBranchChanged = async (b: string) => {
    if (!token || !owner || !repo) return;
    setTree(b ? await getBranch(token, owner, repo, b) : null);
    onChange({ file: null });
  };

  const onFileChanged = async (_f: any) => {};

  const renderPanel = () => {
    const effectiveOwner = ownerState || (user ? user.login : "");

    if (!repos) {
      return false;
    }

    const repositoryOptions = repos.reduce(
      (all: any, cur: any) => ({ ...all, [cur.name]: cur.name }),
      {},
    );
    const branchOptions = branches
      ? branches.reduce(
          (all: any, cur: any) => ({ ...all, [cur.name]: cur.name }),
          {},
        )
      : {};

    const isFilenameInTree = tree && tree.find((x: any) => x.path === file);
    const fileOptions = ["New File", "Select File"];
    return (
      <div className="flex flex-col text-left">
        <InputField
          label="User"
          value={effectiveOwner}
          onChange={(o) => onChange({ owner: o })}
        />
        <div className="flex">
          <SelectorField
            label="Repo"
            options={repositoryOptions}
            value={repo || ""}
            onChange={({ value: r }) => onChange({ repo: r })}
          />
          <SelectorField
            label="Branch"
            options={branchOptions}
            value={branch}
            onChange={({ value: b }) => onChange({ branch: b })}
          />
        </div>

        {!disableFileInput && (
          <RadioGroup
            title="File Mode"
            options={fileOptions}
            value={fileMode}
            onChange={async (opt) => {
              setFileMode(opt as any);
              if (!isFilenameInTree) {
                onChange({ file: null });
              }
            }}
          />
        )}

        {fileMode === "Select File" || disableFileInput
          ? renderFileSelector(file, tree, onChange)
          : renderFileInput(file, onChange)}
      </div>
    );
  };

  const renderFileTree = (f: any, t: any, onChangeFn: any) => {
    const dict: any = {
      blob: "file",
      tree: "folder",
    };
    const items = t
      ? t.map((x: any) => ({
          name: x.path,
          type: dict[x.type],
          sha: x.sha,
        }))
      : [];
    return (
      <div className="text-left">
        <Tree
          selected={f && f.name}
          values={items}
          onChange={onChangeFn}
          onExpand={async (folder: any) => {
            const newTree = await getTree(token, owner, repo, folder.sha);
            setTree(newTree);
            setPath(path?.concat({ sha: folder.sha, name: folder.name }));
          }}
          onPath={async (part: any) => {
            const pos = path?.findIndex((x) => x.name === part) || -1;
            if (pos !== -1) {
              const newTree = await getTree(
                token,
                owner,
                repo,
                path?.[pos].sha,
              );
              const diff = path ? path.length - 1 - pos : 0;
              if (diff > 0) {
                setTree(newTree);
                setPath(path?.slice(0, -diff));
              }
            } else {
              const newTree = await getBranch(token, owner, repo, branch);
              setPath([]);
              setTree(newTree);
            }
          }}
          path={path?.map((x) => x.name)}
        />
      </div>
    );
  };

  const renderFileSelector = (f: any, t: any, onChangeFn: any) => {
    const cb = (_ev: any, { selected: filename }: any) => {
      const parent = path?.slice(-1)[0];
      const treeSHA = parent ? parent.sha : undefined;
      onChangeFn({
        file: {
          name: filename,
          treeSHA,
        },
      });
    };
    return renderFileTree(f, t, cb);
  };

  const renderFileInput = (f: any, onChangeFn: any) => {
    const value = typeof f === "string" ? f : f && f.name;
    return (
      <div className="py-2">
        <SubmittableInput
          fullWidth
          value={value}
          placeholder="New Filename"
          onSubmit={(filename) =>
            onChangeFn({
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

  return renderPanel();
}

type AuthProps = {
  onToken: any;
  clientID: any;
  clientSecret: any;
  redirectURI: any;
  scopes: any;
};
export function GithubOAuth(props: AuthProps) {
  const { onToken, clientID, clientSecret, redirectURI, scopes } = props;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Button
        className="hkp-svc-btn"
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
