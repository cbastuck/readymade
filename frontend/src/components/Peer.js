import React, { Component } from 'react';

import Peerjs from 'peerjs';

import { PeersCtx } from '../PeersContext';

const peerHost = `${window.location.host}`;
const isHTTPS = window.location.protocol === 'https:';


export default class Peer extends Component {

  componentDidMount() {
    this.initPeer();
  }

  componentWillUnmount() {
    if (this.peer) {
      this.peer.destroy();
    }

    const { onPeerRemoved } = this.context;
    const { name } = this.props;
    onPeerRemoved(name);
  }

  initPeer = () => {
    const { 
      name = 'unnamed-peer',
      onData,
    } = this.props;
    const {
      onPeer,
    } = this.context;
    const peer = new Peerjs(
      name, 
      {
        host: peerHost,
        port: isHTTPS ? 443 : 80,
        path: '/peers',
      }
    );
    
    peer.on('open', () => {
      this.peer = peer;
      onPeer(name, peer);
    });

    peer.on('connection', connection => 
      connection.on('data', data => onData(data, connection.peer))
    );
  }

  render() {
    return (
      <div>
        { this.props.children }
      </div>
    );
  }
}

Peer.contextType = PeersCtx;
