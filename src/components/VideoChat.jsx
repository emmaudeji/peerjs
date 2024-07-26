/* eslint-disable no-unused-vars */

import  { useState, useEffect, useRef, useMemo } from 'react';
import peer, { onCall,  } from '../lib/peerService';
import User from './User';
// import axios from 'axios';
import { getUsers, addUser, updateUser, deleteUser, subscribeToChanges, insertCharges } from '../lib/supabase';
import { formatDuration } from '../lib/formatDuration';
import supabase from '../utils/supabaseClient';

// const JSON_SERVER_URL = 'http://localhost:5000/users';

const VideoChat = () => {
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [call, setCall] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [duration, setDuration] = useState('00:00');
  const [users, setUsers] = useState([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [dataConnection, setDataConnection] = useState(null);
  const [charged, setCharged] = useState(0);

  let chargeRate = 2 // #2 per seconds


const initializeUser = async () => {
    console.log('INITIALIZING CALL');
    
    // Retrieve the user from localStorage
    const storedUser = await JSON.parse(localStorage.getItem('user'));

    try {
        // Fetch all users from the server
        const data = await getUsers();
        if (storedUser) {
            // Check if the local user exists on the server
            const userExists = data?.some(user => user.id === storedUser.id);
            
            if (userExists) {
                console.log('User found in localStorage and server, generate new peerId and update user peerId', storedUser);
                peer.on('open', async (id) => {
                  const updatedUser = { ...storedUser, peerId: id,};
                  const updatedUserRes = await updateUser(storedUser.id, updatedUser);
                  localStorage.setItem('user', JSON.stringify(updatedUserRes));
                  setPeerId(id);
                  setUsers(data?.map((item)=>{
                    if(item.id===storedUser.id){
                      return updatedUserRes
                    } else {
                      return item
                    }
                  }));
                  setCurrentUser(updatedUserRes);
              });
            } else {
              console.log('user does not exist in table, creating new user');
              peer.on('open', async (id) => {
                  const newUser = { peerId: id, balance: 10000, name: `User-${id.toString().slice(3,6)}` };
                  const addedUser = await addUser(newUser);
                  localStorage.setItem('user', JSON.stringify(addedUser));
                  setPeerId(id);
                  setUsers([...data, addedUser]);
                  setCurrentUser(addedUser);
              });
          }
        } else {
            console.log('No user found in localStorage, creating new user');
            peer.on('open', async (id) => {
                const newUser = { peerId: id, balance: 10000, name: `User-${id.toString().slice(3,6)}` };
                const addedUser = await addUser(newUser);
                localStorage.setItem('user', JSON.stringify(addedUser));
                setPeerId(id);
                setUsers([...data, addedUser]);
                setCurrentUser(addedUser);
            });
        }
    } catch (error) {
        console.error('Error initializing user:', error);
    }
};

useEffect(() => {
  initializeUser()
  const subscription = supabase.channel('peers')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'peers' },
    (payload) => {
        console.log('REALTIME UPDATED')
      if (payload.eventType === 'INSERT') {
        setUsers([...users, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setUsers(prevUsers => prevUsers.map(user => user.id === payload.new.id ? payload.new : user))
      } else if (payload.eventType === 'DELETE') {
        setUsers(prevUsers => prevUsers.filter(user => user.id !== payload.old.id))
      }
    }
  )
  .subscribe()

  const subscribeToCharges = supabase.channel('charges')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'charges' },
    (payload) => {
        console.log('CHARGES UPDATED',payload)
      if (payload.eventType === 'INSERT') {
        setCall(null);
        remoteVideoRef.current.srcObject = null;
        localVideoRef.current.srcObject = null;
        setCallStartTime(null);
        setDuration(payload.new?.duration)
        setCharged(payload.new?.charge)
      }
    }
  )
  .subscribe()

  return ()=>{
    supabase.removeChannel(subscription)
    supabase.removeChannel(subscribeToCharges)
  }
}, [])

useEffect(() => {
  let interval;

  if (callStartTime && call) {
    interval = setInterval(() => {
      const currentTime = Date.now();
      const callDuration = (currentTime - callStartTime) / 1000; // in seconds
      setDuration(formatDuration(callDuration));
    }, 1000);
  }

  return () => clearInterval(interval); // Clean up the interval on unmount or when callStartTime changes
}, [callStartTime, call]);

useEffect(() => {
  // Set up a listener for incoming calls
  onCall((call) => {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then((stream) => {
              localVideoRef.current.srcObject = stream;
              call.answer(stream);
              call.on('stream', (remoteStream) => {
                  // console.log('STREAMING');
                  remoteVideoRef.current.srcObject = remoteStream;
              });
              setCall(call);
              setCallStartTime(Date.now());
              setRemotePeerId(call.peer); // Ensure remotePeerId is set

              const dataConnection = call.peer.connect(call.peer); // Establish data connection
              dataConnection.on('open', () => {
                // console.log('ESTABLISHED DATACONNECTION');
                  setDataConnection(dataConnection); // Store the data connection
              });

              dataConnection.on('data', (data) => {
                // if(!call) {console.log('Ending call',{data})}else{console.log('Startinging call',{data})}
                  if (data === 'endCall') {
                    console.log('Ending call with data connection',{data})
                      // End the call if the remote peer sends the endCall message
                      endCall();
                  }
              });
          })
        .catch(error => console.error('Error accessing media devices.', error));
  });

  return () => {
      console.log('Component unmounted. Consider handling cleanup if necessary.');
      if (call) {
          call.close();
      }
      if (dataConnection) {
          dataConnection.close();
      }
  };
// }, [call, dataConnection]);
}, []);

const startCall = () => {
  console.log({ remotePeerId, currentUser });
  if (remotePeerId) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then((stream) => {
              localVideoRef.current.srcObject = stream;
              const mediaConnection = peer.call(remotePeerId, stream); // Ensure correct media connection setup
              const dataConnection = peer.connect(remotePeerId); // Establish data connection

              mediaConnection.on('stream', (remoteStream) => {
                  // console.log('STREAMING');
                  remoteVideoRef.current.srcObject = remoteStream;
              });

              dataConnection.on('open', () => {
                  // console.log('UPDATING DATACONNECTION');
                  setDataConnection(dataConnection); // Store the data connection
              });

              setCall(mediaConnection);
              setCallStartTime(Date.now());
              console.log('STREAMING ONGOING');
          })
          .catch(error => console.error('Error accessing media devices.', error));
  }
};

const endCall = async () => {
  if (call) {
    console.log('Call exists, proceeding to end the call');
    const callEndTime = Date.now();
    const callDuration = (callEndTime - callStartTime) / 1000; // in seconds
    const charge = callDuration * chargeRate;
    setCharged(charge)
    // Send a message to the remote peer to end the call
    if (dataConnection && dataConnection.open) {
      dataConnection.send('endCall');
    }
    
    call.close();
    setCall(null);
    remoteVideoRef.current.srcObject = null;
    localVideoRef.current.srcObject = null;
    setCallStartTime(null);
    setDuration('00:00');

    // Ensure currentUser and remotePeerId are valid
    if (!currentUser || !remotePeerId) {
      console.error('currentUser or remotePeerId is invalid');
      return;
    }

    // Update balances
    const updatedCurrentUser = {
      ...currentUser,
      balance: currentUser.balance - charge
    };

    const remoteUser = users.find(user => user.peerId === remotePeerId);

    if (!remoteUser) {
      console.error('remoteUser not found');
      return;
    }

    const updatedRemoteUser = {
      ...remoteUser,
      balance: remoteUser.balance + charge
    };

    try {
      const updatedCurrentUserRes = await updateUser(currentUser.id, updatedCurrentUser);

      const updatedupdatedRemoteUserRes =await updateUser(remoteUser.id, updatedRemoteUser);

      const addCharges =await insertCharges({
        charge:charge,
        rate:chargeRate,
        duration:callDuration,
      });
      console.log({addCharges})

      // Update local state
      setUsers(users.map(user => 
        user.id === currentUser.id ? updatedCurrentUserRes 
        : 
        user.id === remoteUser.id ? updatedupdatedRemoteUserRes 
        : 
        user)
      );
      
      localStorage.setItem('user', JSON.stringify(updatedCurrentUserRes));

      setCurrentUser(updatedCurrentUserRes);
      
    } catch (error) {
      console.error('Error updating user balances:', error);
    }
  } else {
    console.log('No active call to end');
  }
};

const refreshList = async ()=>{
  const data = await getUsers()
  setUsers(data)
}
 
return (
      <div className="space-y-4 p-6 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">chatpal</h1>
        <p className="text-sm max-w-md text-center">If Peer ID is missing, refresh page. If data is not updated in realtime, refresh list.</p>
        <div className="space-y-2 mb-4">
          <p>Your Peer ID: {peerId}</p>
          <input
            type="text"
            value={remotePeerId}
            onChange={(e) => setRemotePeerId(e.target.value)}
            placeholder="Remote Peer ID"
            className="border bg-transparent border-gray-300 p-2 rounded-md w-full"
          />
          <div className="flex justify-between   gap-4 items-center flex-wrap">
            <div className="flex space-x-2">
              <button onClick={startCall} className="px-4 py-2 bg-blue-500 text-white rounded-md">Call</button>
              <button onClick={endCall} className="px-4 py-2 bg-red-500 text-white rounded-md">End Call</button>
            </div>
            <div className="flex gap-2">
              <span>Duration: {duration}</span>
              <span>Charge: ₦{ 
                call ? 
                Math.round((Date.now() - callStartTime) / 1000 * chargeRate)
                : Math.round(charged) }
              </span>
              <span>Rate: ₦{chargeRate}</span>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <video ref={localVideoRef} autoPlay muted className="w-full border border-gray-300 rounded-md" />
          <video ref={remoteVideoRef} autoPlay className="w-full border border-gray-300 rounded-md" />
        </div>
        <div className="mt-4 flex gap-x-4 items-end justify-center w-full">
          <h2 className="text-xl font-bold ">Users List</h2>
          <button onClick={()=>refreshList()} className='bg-gray-700 text-white text-[12px] px-3 py-2 rounded-md'>Refresh list</button>
        </div>
        <ul className="w-full flex justify-center gap-4 flex-wrap border border-gray-300 rounded-md p-4">
          {Array.isArray(users) && users?.map((user,idx) => (
            user.peerId !== peerId ? (
              <li onClick={() => setRemotePeerId(user.peerId)} key={idx} className="">
                <User item={user} idx={idx}/>
              </li>
            ) : (
              <li key={user.peerId} className="">
                <User item={user} idx={idx} you={`(You)`}/>
              </li>
            )
          ))}
        </ul>
      </div>
    );
};

export default VideoChat;
