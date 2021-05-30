import React, { Component } from 'react';
import {Button } from 'semantic-ui-react';
import Peer from 'peerjs';

import { s, t } from '../../styles';
import SelectorField from './SelectorField';

const none = 'none';
const peerHost = `${window.location.host}`;
const isHTTPS = window.location.protocol === 'https:';

export default class Peers extends Component {
  state = {
    peers: [],
    selected: none,
    expanded: false,
  }

  componentDidMount() {
    this.initPeer();
  }

  componentWillUnmount() {
    this.peer.disconnect();
  }

  initPeer = () => {
    const { 
      name = 'unnamed-peer',
      onData,
    } = this.props;
    this.peer = new Peer(name, {
      host: peerHost,
      port: isHTTPS ? 443 : 80,
      path: '/peers',
    });
    this.peer.on('open', this.retrievePeers);
    this.peer.on('connection', connection => 
      connection.on('data', data => 
        onData(data, connection.peer)
      )
    );
    this.peer.on('error', err => {
      console.log('Error - Going to disconnect', err);
      this.peer.disconnect();
      this.peer = undefined;
      setTimeout(this.initPeer, 0);
    });
  }

  retrievePeers = () => {
    const { name } = this.props;
    this.peer.listAllPeers(peers => {
      this.setState({ peers: peers.filter(p => p!== name) });
    });
  }

  sendData = data => {
    const { selected } = this.state;
    if (selected && selected !== none) {
      if (this.connection) {
        if (this.connection.peer === selected) {
          this.connection.send(data);
          return;
        } else { // selected a different peer, close existing and reconnect
          this.connection.close();
          this.connection = undefined;
        }
      }
      const connection = this.peer.connect(selected);
      if (connection) {
        connection.on('open', () => {
          connection.send(data);
          this.connection = connection;
        });
        connection.on('close', () => {
          console.log('Connection closed from remote');
          this.connection = undefined;
        });
      } else {
        console.log('Connection to peer that is not reachable anymore', selected);
        this.connection = undefined;
        this.retrievePeers();
      }
    }
  }

  renderExpanded = () => {
    const { 
      peers, 
      selected,
    } = this.state;
    return (
      <div style={{ padding: 10 }}>
        <h1 style={s(t.tc, t.fs11)}>Routing</h1>
        <SelectorField
        label="Peer"
        options={peers.reduce((a, c) => ({ ...a, [c]: c}), { none })}
        value={selected}
        onChange={(_ev, { value: selected }) => 
          this.setState({ selected })
        }
      />
      <Button
        style={s(t.uc, t.fs11, t.ls1, t.mt2)}
        onClick={this.retrievePeers}
      >
        Update Peers
      </Button>
      </div>
    );
  }

  render() {
    const { 
      expanded, 
    } = this.state;
    const { 
      onExpand,
      onCollapse 
    } = this.props;
    return (
      <div 
        style={s(
          t.uc, t.ls1, t.fs12, 
          { 
            height: '90%',
            minHeight: 140,
            minWidth: expanded && 200,
            marginTop: 10,
          },
          {   
            border: 'solid 1px lightgray',
            borderRight: 'none',
            borderRadius: 5,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          { 
            display: 'flex',
            flexDirection: 'row',
          }
        )}
      >
      <button
        style={{
          height: '100%',
          border: 'none',
          textAlign: 'center',
          backgroundColor: expanded ? 'gray' : '#efefef'
        }}
        onClick={() => { 
          this.setState(
            { expanded: !expanded }, 
            () => {
              if (expanded) {
                onCollapse && onCollapse();
              } else {
                onExpand && onExpand();
              }
            }
          );
        }}
      >
        <div
          style={
            s(
              t.uc, t.ls1, t.fs10,
              { 
                transform: 'rotate(-90deg)',
                marginTop: 30,
                width: 8,
                color: expanded ? 'white' : '#333'
              },
            )}
        >
          Routing
        </div>
      </button>
      { expanded && this.renderExpanded() }
      </div>
    );
  }
}