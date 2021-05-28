import React, { Component } from 'react';
import Peer from 'peerjs';

import { s, t } from '../../styles';

const peerHost = `${window.location.host}`;

export default class Peers extends Component {
  state = {
    peers: [],
  }

  componentDidMount() {
    const { 
      name = 'unnamed-peer',
      onData,
    } = this.props;
    this.peer = new Peer(name, {
      host: peerHost,
      port: 80,
      path: '/peers'
    });
    this.peer.on('open', id => {
      this.peer.listAllPeers(peers => {
        //const selected = peers.find(p => p!== name );
        this.setState({ peers });
      }) 
    });
    this.peer.on('connection', connection => {
      const peer = connection.peer;
      console.log('Peer connected', peer);
      connection.on('data', data => {
        onData(data)
      });
    });
  }

  componentWillUnmount() {
    this.peer.disconnect();
  }

  sendData = data => {
    const { selected } = this.state;
    if (selected) {
      const connection = this.peer.connect(selected);
      connection.on('open', () => {
        console.log('Connection to peer opened', selected);
        console.log('Sending data', data);
        connection.send(data);
      });
    }
  }

  render() {
    const { peers } = this.state;
    return (
      <div style={s(t.uc, t.ls1, t.fs12, t.p10)}>
        Available peers: 
        {
          peers.map((p, i) => (
            <span
              key={`${p}-${i}`}
              style={{ cursor: 'pointer' }}
              onClick={() => this.setState({ selected: p })}
            >
              {`${p}, `} 
            </span>
          )) 
        }
      </div>
    );
  }
}