import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { io } from 'socket.io-client';

// react-native-webrtc is a native module; guard the import so the app doesn't
// crash on a binary that doesn't include it (Expo Go). If the require succeeds
// and the API is present, treat it as available — don't probe NativeModules,
// which is unreliable under the New Architecture (TurboModules).
let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCView, mediaDevices;
let webrtcAvailable = false;
try {
  // eslint-disable-next-line global-require
  const RTC = require('react-native-webrtc');
  ({ RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCView, mediaDevices } = RTC);
  webrtcAvailable = !!RTCPeerConnection && typeof mediaDevices?.getUserMedia === 'function';
} catch (e) {
  webrtcAvailable = false;
  console.warn('[CallScreen] react-native-webrtc not available — calls disabled:', e?.message);
}
import { tokenStore } from '../api/tokenStore';
import { ICE_SERVERS, SOCKET_URL } from '../utils/webrtc';
import { colors, spacing, type } from '../theme';

// In-app WebRTC call (rider side) for a support ticket. Peer-to-peer media; the
// backend only relays signaling. Mounted while a thread is open so it can also
// receive a call from the agent. Parent starts an outgoing call via ref: start('video').
function CallScreen({ ticketId }, ref) {
  const [status, setStatus] = useState('idle'); // idle | calling | incoming | connected
  const [media, setMedia] = useState('video');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localUrl, setLocalUrl] = useState(null);
  const [remoteUrl, setRemoteUrl] = useState(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef([]);
  const isCallerRef = useRef(false);

  const startRing = () => { Vibration.vibrate([0, 1000, 1500], true); };
  const stopRing = () => { Vibration.cancel(); };

  const endLocal = () => {
    stopRing();
    pcRef.current?.close(); pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidates.current = [];
    isCallerRef.current = false;
    setLocalUrl(null); setRemoteUrl(null); setStatus('idle');
  };

  const newPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.addEventListener('icecandidate', (e) => {
      if (e.candidate) socketRef.current?.emit('call:signal', { room: ticketId, data: { candidate: e.candidate } });
    });
    pc.addEventListener('track', (e) => { if (e.streams?.[0]) setRemoteUrl(e.streams[0].toURL()); });
    pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) endLocal();
    });
    pcRef.current = pc;
    return pc;
  };

  const getMedia = async (m) => {
    const video = m === 'video'
      ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      : false;
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const stream = await mediaDevices.getUserMedia({ audio, video });
    localStreamRef.current = stream;
    setLocalUrl(stream.toURL());
    setMicOn(true); setCamOn(m === 'video');
    return stream;
  };

  const attachTracks = (pc, stream) => {
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.getSenders().forEach((s) => {
      if (s.track?.kind === 'video') {
        const params = s.getParameters();
        params.encodings = [{ maxBitrate: 2_500_000, maxFramerate: 30 }];
        s.setParameters(params).catch(() => {});
      }
    });
  };

  const flushCandidates = async () => {
    const pc = pcRef.current;
    while (pendingCandidates.current.length) {
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.current.shift()));
    }
  };

  const createOffer = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit('call:signal', { room: ticketId, data: { sdp: pc.localDescription } });
  };

  const handleSignal = async (data) => {
    let pc = pcRef.current;
    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        if (!pc) { pc = newPeer(); attachTracks(pc, localStreamRef.current || await getMedia(media)); }
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('call:signal', { room: ticketId, data: { sdp: pc.localDescription } });
        setStatus('connected');
      } else if (data.sdp.type === 'answer' && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushCandidates();
        setStatus('connected');
      }
    } else if (data.candidate) {
      if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      else pendingCandidates.current.push(data.candidate);
    }
  };

  const startCall = async (m) => {
    if (!webrtcAvailable) {
      Alert.alert('Calls unavailable', 'In-app calling needs the latest app build. Please update the app.');
      return;
    }
    try {
      setMedia(m); setStatus('calling'); isCallerRef.current = true;
      startRing();
      const stream = await getMedia(m);
      attachTracks(newPeer(), stream);
      socketRef.current?.emit('call:invite', { room: ticketId, media: m });
    } catch (e) {
      endLocal();
      Alert.alert('Could not start call', e?.message || 'Allow camera & microphone access and try again.');
    }
  };

  const acceptCall = async () => {
    isCallerRef.current = false;
    stopRing();
    await getMedia(media);
    socketRef.current?.emit('call:accept', { room: ticketId });
    setStatus('connected');
  };

  const rejectCall = () => { socketRef.current?.emit('call:reject', { room: ticketId }); endLocal(); };
  const hangUp = () => { socketRef.current?.emit('call:end', { room: ticketId }); endLocal(); };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  useImperativeHandle(ref, () => ({ start: (m) => startCall(m) }));

  useEffect(() => {
    if (!ticketId || !webrtcAvailable) return undefined;
    const { accessToken } = tokenStore.get();
    const socket = io(SOCKET_URL, { auth: { token: accessToken, role: 'user' }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('call:join', { room: ticketId }));
    socket.on('call:incoming', ({ media: m }) => { setMedia(m || 'video'); setStatus('incoming'); startRing(); });
    socket.on('call:accepted', () => { stopRing(); if (isCallerRef.current) createOffer(); });
    socket.on('call:rejected', () => endLocal());
    socket.on('call:ended', () => endLocal());
    socket.on('call:signal', ({ data }) => handleSignal(data));

    return () => { socket.emit('call:leave', { room: ticketId }); socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  if (status === 'idle') return null;

  return (
    <View style={styles.overlay}>
      {remoteUrl
        ? <RTCView streamURL={remoteUrl} style={styles.remote} objectFit="cover" />
        : <View style={[styles.remote, styles.remotePlaceholder]} />}
      {localUrl && media === 'video' && (
        <RTCView streamURL={localUrl} style={styles.local} objectFit="cover" mirror zOrder={1} />
      )}

      {status !== 'connected' && (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>{status === 'calling' ? 'Calling support…' : 'Incoming call'}</Text>
          <Text style={styles.statusSub}>{media} call</Text>
        </View>
      )}

      <View style={styles.controls}>
        {status === 'incoming' ? (
          <>
            <Pressable style={[styles.ctrl, styles.accept]} onPress={acceptCall}>
              <Ionicons name="call" size={26} color="#fff" />
            </Pressable>
            <Pressable style={[styles.ctrl, styles.end]} onPress={rejectCall}>
              <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={[styles.ctrl, styles.soft]} onPress={toggleMic}>
              <Ionicons name={micOn ? 'mic' : 'mic-off'} size={22} color="#fff" />
            </Pressable>
            {media === 'video' && (
              <Pressable style={[styles.ctrl, styles.soft]} onPress={toggleCam}>
                <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={22} color="#fff" />
              </Pressable>
            )}
            <Pressable style={[styles.ctrl, styles.end]} onPress={hangUp}>
              <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0e0c', zIndex: 100 },
  remote: { flex: 1 },
  remotePlaceholder: { backgroundColor: '#11151300', alignItems: 'center', justifyContent: 'center' },
  local: { position: 'absolute', width: 110, height: 150, right: 16, bottom: 120, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  statusBox: { position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center' },
  statusTitle: { ...type.h2, color: '#fff' },
  statusSub: { ...type.body, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize', marginTop: 4 },
  controls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  ctrl: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  soft: { backgroundColor: 'rgba(255,255,255,0.2)' },
  accept: { backgroundColor: colors.success },
  end: { backgroundColor: colors.danger },
});

export default forwardRef(CallScreen);
