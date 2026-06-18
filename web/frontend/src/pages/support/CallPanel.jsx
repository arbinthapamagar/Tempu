import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from '@/components/ui/icons'
import { ICE_SERVERS, SOCKET_URL } from '../../utils/webrtc'

// In-app WebRTC call for a support ticket (agent side). The agent can start a
// call or answer one rung by the rider. Media is peer-to-peer; the backend only
// relays signaling. Mounted (hidden) while a ticket is open so it can also
// receive incoming calls. Parent triggers an outgoing call via the ref: start('video').
function CallPanel({ ticketId }, ref) {
  const [status, setStatus] = useState('idle') // idle | calling | incoming | connected
  const [media, setMedia] = useState('video')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pendingCandidates = useRef([])
  const isCallerRef = useRef(false)

  // WebRTC helpers, defined before the hooks that use them.
  const endLocal = () => {
    pcRef.current?.close(); pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    pendingCandidates.current = []
    isCallerRef.current = false
    setStatus('idle')
  }

  const newPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('call:signal', { room: ticketId, data: { candidate: e.candidate } })
    }
    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0] }
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) endLocal()
    }
    pcRef.current = pc
    return pc
  }

  const getMedia = async (m) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: m === 'video' })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    setMicOn(true); setCamOn(m === 'video')
    return stream
  }

  const attachTracks = (pc, stream) => stream.getTracks().forEach((t) => pc.addTrack(t, stream))

  const flushCandidates = async () => {
    const pc = pcRef.current
    while (pendingCandidates.current.length) {
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.current.shift()))
    }
  }

  const createOffer = async () => {
    const pc = pcRef.current
    if (!pc) return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socketRef.current?.emit('call:signal', { room: ticketId, data: { sdp: pc.localDescription } })
  }

  const handleSignal = async (data) => {
    let pc = pcRef.current
    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        if (!pc) { pc = newPeer(); attachTracks(pc, localStreamRef.current || await getMedia(media)) }
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        await flushCandidates()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socketRef.current?.emit('call:signal', { room: ticketId, data: { sdp: pc.localDescription } })
        setStatus('connected')
      } else if (data.sdp.type === 'answer' && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        await flushCandidates()
        setStatus('connected')
      }
    } else if (data.candidate) {
      if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
      else pendingCandidates.current.push(data.candidate)
    }
  }

  const startCall = async (m) => {
    setMedia(m); setStatus('calling'); isCallerRef.current = true
    const stream = await getMedia(m)
    attachTracks(newPeer(), stream)
    socketRef.current?.emit('call:invite', { room: ticketId, media: m })
    // Offer is created once the callee accepts (on 'call:accepted').
  }

  const acceptCall = async () => {
    isCallerRef.current = false
    await getMedia(media)
    socketRef.current?.emit('call:accept', { room: ticketId })
    setStatus('connected')
    // The caller now sends an offer → handled in handleSignal.
  }

  const rejectCall = () => { socketRef.current?.emit('call:reject', { room: ticketId }); endLocal() }
  const hangUp = () => { socketRef.current?.emit('call:end', { room: ticketId }); endLocal() }

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled) }
  }
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled) }
  }

  useImperativeHandle(ref, () => ({ start: (m) => startCall(m) }))

  // Wire up the call signalling socket and tear it down on unmount.
  useEffect(() => {
    if (!ticketId) return undefined
    const token = localStorage.getItem('shakti_admin_token')
    const socket = io(SOCKET_URL, { auth: { token, role: 'admin' }, transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => socket.emit('call:join', { room: ticketId }))
    socket.on('call:incoming', ({ media: m }) => { setMedia(m || 'video'); setStatus('incoming') })
    socket.on('call:accepted', () => { if (isCallerRef.current) createOffer() })
    socket.on('call:rejected', () => endLocal())
    socket.on('call:ended', () => endLocal())
    socket.on('call:signal', ({ data }) => handleSignal(data))

    return () => { socket.emit('call:leave', { room: ticketId }); socket.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  if (status === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center">
      <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-24 right-6 w-40 h-56 object-cover rounded-xl border-2 border-white/30 shadow-lg" />

      {status !== 'connected' && (
        <div className="relative z-10 text-center text-white">
          <p className="text-lg font-semibold">{status === 'calling' ? 'Calling rider…' : 'Incoming call'}</p>
          <p className="text-sm text-white/60 capitalize">{media} call</p>
        </div>
      )}

      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-3 z-10">
        {status === 'incoming' ? (
          <>
            <button onClick={acceptCall} className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white">
              <Phone className="h-6 w-6" />
            </button>
            <button onClick={rejectCall} className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white">
              <PhoneOff className="h-6 w-6" />
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMic} className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            {media === 'video' && (
              <button onClick={toggleCam} className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            )}
            <button onClick={hangUp} className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white">
              <PhoneOff className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default forwardRef(CallPanel)
