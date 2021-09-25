import Peerjs from '../node_modules/peerjs/dist/peerjs.js';

const { host, protocol } = window.location;

function to(name, onPeer, onData) {
    const peer = new Peerjs(
      name, 
      {
        host,
        port: protocol === 'https:' ? 443 : 80,
        path: '/peers',
      }
    );
    peer.on('open', () => {
      onPeer(name, peer);
    });

    peer.on('connection', connection => 
      connection.on('data', data => onData(data, connection.peer))
    );
}

window.hookup = { to };