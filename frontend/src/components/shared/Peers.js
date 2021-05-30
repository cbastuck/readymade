import React, { Component } from 'react';
import Peer from 'peerjs';

import { s, t } from '../../styles';
import SelectorField from './SelectorField';

const none = 'none';
const peerHost = `${window.location.host}`;

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
      port: 80,
      path: '/peers',
    });
    this.peer.on('open', id => this.retrievePeers());
    this.peer.on('connection', connection => {
      const peer = connection.peer;
      console.log('Peer connected', peer);
      connection.on('data', data => {
        onData(data)
      });
    });
    this.peer.on('error', err => {
      console.log('Error', err);
      this.peer.disconnect();
      this.peer = undefined;
      setTimeout(this.initPeer, 0);
    });
  }

  retrievePeers = () => {
    this.peer.listAllPeers(peers => {
      this.setState({ peers });
    });
  }

  sendData = data => {
    const { selected } = this.state;
    if (selected && selected !== none) {
      const connection = this.peer.connect(selected);
      if (connection) {
        connection.on('open', () => {
          console.log('Connection to peer opened', selected);
          console.log('Sending data', data);
          connection.send(data);
        });
      } else {
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
      </div>
    );
  }

  render() {
    const { expanded } = this.state;
    return (
      <div 
        style={s(
          t.uc, t.ls1, t.fs12, 
          { 
            height: '90%',
            minHeight: 140,
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
        }}
        onClick={() => { 
          this.setState({ expanded: !expanded });
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
                marginLeft: expanded ? -20 : 0
              },
            )}
        >
          { !expanded && 'Routing' }
        </div>
      </button>
      { expanded && this.renderExpanded() }
      </div>
    );
  }
}