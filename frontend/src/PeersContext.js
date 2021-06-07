import React, { Component, createContext } from 'react';
const PeersCtx = createContext();

class PeersContext extends Component {
  constructor(props) {
    super(props);
    this.state = {
      peers: {},
      connections: {},
      peerNames: [],
      onPeer: this.onPeer,
      updatePeers: this.updatePeers,
    }
  }

  onPeer = (peerName, peer) => {
    peer.on('error', err => {
      console.log('Error - Going to disconnect', err);
    });

    this.setState({ 
      peers: {
        ...this.state.peers,
        [peerName]: peer,
      }
    });
    
    this.updatePeers(peer);
  }

  updatePeers = peer => {
    if (!peer) {
      const firstPeer = Object.keys(this.state.peers)[0];
      peer = firstPeer && this.state.peers[firstPeer];
      if (!peer) {
        console.error('PeersContext how could this happen');
        return;
      }
    }
    peer.listAllPeers(peerNames => this.setState({ peerNames }));
  }

  sendData = (src, dst, data) => { 
    const connectID = `${src}-${dst}`;
    let connection = this.state.connections[connectID];
    if (connection) {
      connection.send(data);
      return;
    }
    const srcPeer = this.state.peers[src];
    if (!srcPeer) {
      console.warn('Trying to send data from an unregistered peer', src, JSON.stringify(this.state.peers));
      return;
    }
    connection = srcPeer.connect(dst);
    if (connection) {
      connection.on('open', () => {
        connection.send(data);
        this.setState({ 
          connections: {
            ...this.state.connections,
            [connectID]: connection,
          }
        });
      });
      connection.on('close', () => {
        console.log('Connection closed from remote');
        this.setState({ 
          connections: Object.keys(this.state.connections).reduce(
            (acc, k) => k === connectID ? acc : { ...acc, [k]: this.state.connections[k]},
            {}
          )
        });
      });
    } else {
      console.log('Connection to peer that is not reachable anymore', connectID);
      this.retrievePeers();
    }
  }

  render() {
    const { children } = this.props;
    return (
      <PeersCtx.Provider
        value={{
          ...this.state
        }}
      >
        { children }
      </PeersCtx.Provider>
    );
  }
}


const PeersConsumer = PeersCtx.Consumer;
export { PeersConsumer, PeersCtx };
export default PeersContext;
