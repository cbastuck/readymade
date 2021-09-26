import Peerjs from '../node_modules/peerjs/dist/peerjs.js';

const { host: thisHost, protocol } = window.location;
const empty =() => {};
function to(name, { host=thisHost, onPeer=empty, onData=empty }) {
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