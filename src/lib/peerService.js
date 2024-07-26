import Peer from 'peerjs';

const peer = new Peer({
  host: '0.peerjs.com',
  port: 443,
  path: '/'
});

// Function to connect to another peer
export const connectToPeer = (peerId) => {
  return peer.connect(peerId);
};

// Function to set up listener for incoming calls
export const onCall = (callback) => {
  peer.on('call', (call) => {
    callback(call);
  });
};

// Function to call another peer
export const callPeer = (peerId, stream) => {
  return peer.call(peerId, stream);
};

export default peer;
