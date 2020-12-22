import React, { Component } from 'react';
import { Button, Tab, Menu, Card, Icon } from 'semantic-ui-react';

import InputField from './shared/InputField';
import { shareBoard, getShares, removeShare } from '../core/actions';
import QR from './QR';
import { s, t } from '../styles';

export default class Share extends Component {
  state = {
    shareEmail: '',
    shareUrl: '',
    shares: [],
  };

  inputs = {};

  emailValidation = /^\S+@\S+\.\S+$/;

  componentDidMount() {
    this.retrieveShares();
  }

  retrieveShares = async () => {
    const { board } = this.props; 
    const shares = await getShares(board);
    this.setState({ shares });
  }

  makeShareUrl = id => {
    return `${window.location.protocol}//${window.location.host}/join/${id}`;
  }

  onShare = async () => {
    const { board } = this.props; 
    const { shareEmail } = this.state;
    const share = await shareBoard(board, { email:  shareEmail });
    const { id } = share || {};
    if (id) {
      const url = this.makeShareUrl(id);
      await this.retrieveShares();
      this.setState({ shareUrl: url });
    }
  }

  isValidEmail = email => {
    return email && email.match(this.emailValidation);
  }

  renderShareLink = url => {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        <div style={s(t.w100) }>
          <input
            ref={input => this.inputs[url] = input} 
            style={s(t.w100, t.fs14, { border: 'none' }, { color: '#4183c4'})}
            type="text" 
            value={url}
          /> 
        </div>
        <div style={t.m(5, 0)}>
          <Icon 
            name="copy"
            onClick={() => {
              this.inputs[url].select();
              document.execCommand('copy');
            }}
          />
        </div>
      </div>
    );
  }

  renderShareCard = (share, url) => {
    const { board } = this.props; 
    return (
      <Card 
        key={`share-${url}`}
        style={s(t.nc, t.m5, { overflowX: 'auto', minWidth: 350 })}
      >
        <Card.Content>
          <Card.Header 
            style={s(t.uc, t.fs12, t.ls1) }
          >
            {share.email}
          </Card.Header>
          <Card.Description>
            { this.renderShareLink(url) }
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div className="ui two buttons">
            <Button 
              style={s(t.uc, t.ls1, t.fs12)}
              basic 
              onClick={async () => {
                await removeShare(board, share);
                this.retrieveShares();
              }}
            >
              Unshare
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  renderShareManager = () => {
    const { shares } = this.state;
    return ( 
      shares && shares.length > 0 && ( 
        <div>
          <div style={s(t.m5, t.fs12)}>
            This board is shared with following users 
          </div>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex', 
              flexDirection: 'row',
              flexFlow: 'row wrap',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
          {
            shares.map((share, idx) => {
              const url = this.makeShareUrl(share.id);
              return this.renderShareCard(share, url)
            })
          }
          </div>
        </div>
      )
    )
  }

  renderNewShare = () => {
    const { shareEmail, shareUrl } = this.state;
    return (
      <div 
        style={{ 
          height: '100%',
          width: '100%',
          textAlign: 'center'
        }}
      >
        <div>
          <InputField
            synced={false}
            label="email"
            value={shareEmail}
            onChange={(_, { value: shareEmail }) => 
              this.setState({ shareEmail })
            }
          />
          <Button
            style={s(t.uc, t.ls1, t.fs11, t.w100)}
            onClick={this.onShare}
            disabled={!this.isValidEmail(shareEmail)}
          >
            Add Share
          </Button>
        </div>
        {
           shareUrl && (
            <div 
              style={s(t.m(10, 20), t.uc, t.ls1, t.fs12)}
            >
              This board is now shared with 
                <span style={t.nc}> { shareEmail } </span>
              via the following link:
              <div style={s.m10}>
                <QR url={shareUrl} />
                <div style={s(t.nc, { width: '50%', margin: 'auto' })}>
                  { this.renderShareLink(shareUrl) }
                </div>
              </div>
            </div>
          )
        }
      </div>
    );
  }

  render() {
    const panes = [
      { 
        menuItem: (
          <Menu.Item 
            key={`share-tab-add`} 
            style={ s(t.fs11, t.uc, t.ls1) }
            name="New"
          />
        ),
        render: () => <Tab.Pane>{this.renderNewShare()}</Tab.Pane> 
      },
      { 
        menuItem: (
          <Menu.Item 
            key={`share-tab-manage`} 
            style={ s(t.fs11, t.uc, t.ls1) }
            name="Manage"
          />
        ), 
        render: () => <Tab.Pane>{this.renderShareManager()}</Tab.Pane> 
      },
    ]
     return <Tab style={t.uc} panes={panes} />;
  }
}