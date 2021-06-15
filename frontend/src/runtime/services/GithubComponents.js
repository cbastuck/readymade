import React, { Component } from 'react';
import { Button, Card, Icon, Image } from 'semantic-ui-react';

import SelectorField from '../../components/shared/SelectorField';
import InputField from '../../components/shared/InputField';
import { s, t } from '../../styles';
import {
  getUser,
  getRepos,
  getBranches,
  getTree,
} from './GithubAPI'; 

export class GithubUser extends Component {
  state = { user: null };

  componentDidMount() {
    const { token } = this.props;
    getUser(token)
      .then(user => this.setState({ user }));
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
    const { token } = this.props;
    getUser(token)
      .then(user => {
        this.setState({ user });
        return getRepos(token, user.login);
      })
      .then(repos => this.setState({ repos }));
  }

  renderPanel = service => {
    const { token } = this.props
    const {
      user,
      owner = user ? user.login : '',
      repos,
      repo,
      branch,
      branches,
      tree,
      filename,
    } = this.state;

    if (!repos) {
      return false;
    }

    const repositoryOptions = repos.reduce(
      (all, cur) => ({...all, [cur.name]: cur.name}), {}
    );
    const branchOptions = branches && branches.reduce(
      (all, cur) => ({ ...all, [cur.name]: cur.name }), {}
    );
    const filesOptions = tree && tree.reduce(
      (all, cur) => ({...all, [cur.path]: cur.path}), {}
    );

    return (
      <div>
        <InputField 
          label="Owner"
          value={owner}
          onChange={(_, { value: owner }) => {
            this.setState(
              { owner },
              () => getRepos(token, owner)
                .then(repos => this.setState({ repos }))
            )
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
            )
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
          }}
        />
        <SelectorField 
          label="file"
          onChange={(_, { value: filename }) => 
            this.setState({ filename })
          }
          value={filename}
          options={filesOptions}
        />
      </div>
    );
    }
  
  render() {
    const { service } = this.props;
    return this.renderPanel(service);
  }
}