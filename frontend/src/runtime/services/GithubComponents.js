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
  
  async init() {
    const { 
      token,
      owner,
      repo,
      branch,
      file: filename,
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
      filename,
    });
  }

  renderPanel = service => {
    const { 
      token, 
      onChange,
      disableNewFiles,
    } = this.props;
    const {
      user,
      owner = user ? user.login : '',
      repos,
      repo,
      branch,
      branches,
      tree,
      filename,
      toggleNew,
    } = this.state;

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
    const filesOptions = tree ? 
      tree.reduce(
        (all, cur) => ({...all, [cur.path]: cur.path}), {}
      ) : 
      {};
    const insertNewFilename = !disableNewFiles && (toggleNew || (filename && !filesOptions[filename]));
    return (
      <div>
        <InputField 
          label="Owner"
          value={owner}
          onChange={(_, { value: owner }) => {
            this.setState(
              { owner },
              () => getRepos(token, owner)
                .then(repos => this.setState({ 
                  repos,
                  branches: [],
                  branch: null,
                  tree: null,
                  filename: ''
                }))
            );
            onChange({ owner });
          }}
        />
        <SelectorField
          label="repo"
          options={repositoryOptions}
          value={repo || ''}
          onChange={(_, { value: repo }) => {
            this.setState(
              { repo },
              () => getBranches(token, owner, repo)
                .then(branches => this.setState({ branches }))
            );
            onChange({ repo });
          }}
        />
        <SelectorField
          label="branch"
          options={branchOptions}
          value={branch}
          onChange={(_, { value: branch }) => {
            this.setState(
              { branch },
              () => getTree(token, owner, repo, branch)
                .then(tree => this.setState({ tree }))
            );
            onChange({ branch });
          }}
        />
        <div style={t.tl}>
          {
            insertNewFilename ? (
              <InputField 
                label="file"
                value={filename}
                onChange={(_, { value: filename }) => {
                  this.setState({ filename });
                  onChange({ file: filename });
                }}
              />
            ) : ( 
              <SelectorField 
                label="file"
                onChange={(_, { value: filename }) => {
                  this.setState({ filename });
                  onChange({ file: filename });
                }}
                value={filename}
                options={filesOptions}
              />
            )
          }
          { 
            !disableNewFiles && (
              <Checkbox
                toggle
                label="Insert New File"
                style={s(t.uc, t.fs12, t.m(0, 1))}
                checked={!!insertNewFilename}
                onChange={async (_, { checked: toggleNew }) => 
                  this.setState({ 
                    toggleNew,
                    filename: ''
                  })
                }
              />
            )
          }
        </div>
      </div>
    );
    }
  
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

