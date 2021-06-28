import React, { Component } from 'react';
import { 
  Button, 
  Card, 
  Icon, 
  Image,
  Checkbox,
} from 'semantic-ui-react';

import MessageReceiver from '../../MessageReceiver';
import SelectorField from '../../components/shared/SelectorField';
import InputField from '../../components/shared/InputField';
import Tree from '../../components/shared/Tree';
import { s, t } from '../../styles';
import {
  getUser,
  getRepos,
  getBranches,
  getTree,
  getAuthURL,
  exchangeCode,
} from './GithubAPI'; 

const loginStateId = 'github-login';

export class GithubUser extends Component {
  state = { user: null };

  componentDidMount() {
    const { token } = this.props;
    this.init(token);
  }

  init = async token => {
    const user = await getUser(token);
    const { onUser } = this.props;
    if (user) {
      this.setState({ user });
      if (onUser) {
        onUser(user);
      }
    }
  }

  render() {
    const { user } = this.state;
    if (!user) {
      return false;
    }
    const { 
      size='small',
      onLogout,
    } = this.props;
    const { 
      login, 
      avatar_url, 
      created_at,
      public_repos,
      followers
    } = user;
    return (
      <div style={s(t.uc, t.fs12, t.ls1)}>
        <Card>
          <div style={t.tc}> 
            <Image 
              src={avatar_url} 
              wrapped 
              size={size}
            />
          </div>
          <Card.Content>
            <Card.Header>{login}</Card.Header>
            <Card.Meta>Joined in {created_at}</Card.Meta>
            <Card.Description>
              The user has {public_repos} public repositories
            </Card.Description>
          </Card.Content>
          <Card.Content extra>
            <Icon name='user' />
            {followers} Followers 
          </Card.Content>
        </Card>
        <Button 
          style={s(t.uc, t.fs12, t.ls1, t.w100)}
          onClick={() => onLogout && onLogout()}
        >
          Logout
        </Button>
      </div>
    )
  }
}

export class GithubObject extends Component {
  state = {};

  componentDidMount() {
    this.init();
  }

  componentDidUpdate(prevProps) {
    const {
      owner,
      repo,
      branch,
      file
    } = this.props;
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
    const { 
      token,
      owner,
      repo,
      branch,
    } = this.props;
    const user = await getUser(token);
    const repos = await getRepos(token, owner || user.login);
    const branches = repo ? await getBranches(token, owner || user.login, repo) : [];
    const tree = (branch && repo) ? await getTree(token, owner || user.login, repo, branch) : [];
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

  onOwnerChanged = async owner => {
    const { 
      token, 
      onChange,
    } = this.props;
    const repos = await getRepos(token, owner);
    this.setState({ 
      repos,
      branches: [],
      tree: null,
    });
    onChange({ owner });
  }

  onRepoChanged = async repo => {
    const {
      token,
      owner,
      branch,
      onChange,
    } = this.props;
    const branches = await getBranches(token, owner, repo);
    if (branches.find(b => b.name === branch)) { // same branch-name exists in new repo
      const tree = await getTree(token, owner, repo, branch);
      this.setState({ 
        branches, 
        tree,
      });
      onChange({ file: '' });
    } else {
      this.setState({ 
        branches, 
        tree: null,
      });
      const first = branches && branches[0];
      onChange({ branch: first ? first.name : '', file: '' });
    }
  }

  onBranchChanged = async branch => {
    const {
      token,
      owner, 
      repo,
      onChange,
    } = this.props;

    this.setState({ 
      tree: branch ? await getTree(token, owner, repo, branch) : null,
    });
    onChange({ file: '' });
  }

  onFileChanged = async file => {
  }

  renderPanel = service => {
    const {
      onChange,
      disableFileInput,
      branch,
      repo,
      file,
    } = this.props; // selections come from props
    const {
      user,
      owner = user ? user.login : '',
      repos,
      branches,
      tree,
      renderAsFileInputToggle=true
    } = this.state; // options come from state

    if (!repos) {
      return false;
    }

    const repositoryOptions = repos.reduce(
      (all, cur) => ({...all, [cur.name]: cur.name}), {}
    );
    const branchOptions = branches ? 
      branches.reduce(
        (all, cur) => ({ ...all, [cur.name]: cur.name }), {}
      ) : 
      {};

    const isFilenameInTree = !!tree.find(x => x.path === file);
    const renderAsFileInput = disableFileInput ? 
      false :
      (
        isFilenameInTree ? 
          renderAsFileInputToggle : 
          (
            file ? 
              true : 
              renderAsFileInputToggle
          )
      );
    return (
      <div>
        <InputField 
          label="Owner"
          value={owner}
          onChange={(_, { value: owner }) => onChange({ owner })}
        />
        <SelectorField
          label="repo"
          options={repositoryOptions}
          value={repo || ''}
          onChange={(_, { value: repo }) => onChange({ repo })}
        />
        <SelectorField
          label="branch"
          options={branchOptions}
          value={branch}
          onChange={(_, { value: branch }) => onChange({ branch })}
        />
        <div style={t.tl}>
          { 
            !disableFileInput && (
              <Checkbox
                toggle
                label={renderAsFileInputToggle ? 'Enter Filename' : 'Select File'}
                style={s(t.uc, t.fs12, t.mt5, t.mb3)}
                checked={!!renderAsFileInputToggle}
                onChange={async (_, { checked: renderAsFileInputToggle }) => {
                  this.setState({ renderAsFileInputToggle });
                  if (!isFilenameInTree) {
                    onChange({ file: '' });
                  }
                }}
              />
            )
          }
          {
            renderAsFileInput ? 
              this.renderFileInput(file, onChange) : 
              this.renderFileSelector(file, tree, onChange)
          }
        </div>
      </div>
    );
  }

  renderFileTree = (file, tree, onChange) => {
    const dict = {
      blob: 'file',
      tree: 'folder',
    };
    const items = tree.map(x => ({ name: x.path, type: dict[x.type] }));
    return (
      <Tree
        selected={file}
        values={items}
        onChange={onChange}
      />
    );
  }
  
  renderFileSelector = (file, tree, onChange) => {
    const renderAsTree = true;
    if (renderAsTree) {
      return this.renderFileTree(
        file, 
        tree, 
        (_, { selected: file }) => onChange({ file })
      )
    }

    const filesOptions = tree ? 
      tree.reduce(
        (all, cur) => ({...all, [cur.path]: cur.path }), {}
      ) : 
      {};
    return (
      <SelectorField 
        label="file"
        onChange={(_, { value: file }) => onChange({ file })}
        value={file}
        options={filesOptions}
      />
    );
  }

  renderFileInput = (file, onChange) => (
    <InputField 
      label="file"
      value={file}
      onChange={(_, { value: file }) => onChange({ file })}
    />
  )

  render() {
    const { service } = this.props;
    return this.renderPanel(service);
  }
}

export class GithubOAuth extends Component {
  render() {
    const { 
      onToken,
      clientID,
      clientSecret,
      redirectURI,
      scopes
    } = this.props;
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Button
          style={s(t.uc, t.ls1, t.fs12)}
          onClick={() => {
            const url = getAuthURL({ 
              clientID,
              clientSecret,
              scopes,
              redirectURI,
              state: loginStateId,
            });
            if (url) {
              window.open(url, 'blank');
            }
          }}
        >
          Login
        </Button>
        <MessageReceiver
          state={loginStateId}
          onData={async data => {
            const { code } = data;
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
    )
  }
}

