import Peerjs from '../node_modules/peerjs/dist/peerjs.js';

function hookupTo(name, onPeer, onData) {
    const peer = new Peerjs(
      name, 
      {
        host:"hookup.to",
        port: 443,
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

window.hookupTo = hookupTo;