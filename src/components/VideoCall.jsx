import React, { useEffect, useRef, useState } from "react";
import "./VideoCall.css";
import FeedbackForm from "./FeedbackForm";
import { getIceServers } from "../hooks/useIceServers";

// VideoCall component
export default function VideoCall({ 
  roomId, 
  isTutor = false, 
  userName = "You", 
  session = null, 
  onClose = () => {}, 
  onSubmitFeedback = null, 
  ...props 
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [showFeedback, setShowFeedback] = useState(false);
  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);

  // Set up WebRTC and WebSocket inside useEffect, and clean up on unmount or room change
  useEffect(() => {
    if (!roomId) return;

    const initializeWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create WebSocket connection for signaling
        const apiUrlRaw = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const apiUrl = apiUrlRaw.replace(/\/$/, "");
        let wsBase;
        try {
          const api = new URL(apiUrl);
          const wsProtocol = api.protocol === "https:" ? "wss:" : "ws:";
          wsBase = `${wsProtocol}//${api.host}`;
        } catch (_err) {
          wsBase = apiUrl.startsWith("https") ? "wss://localhost:5000" : "ws://localhost:5000";
        }

        const ws = new WebSocket(`${wsBase}/ws?roomId=${encodeURIComponent(roomId)}`);
        wsRef.current = ws;

        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            setConnectionStatus("error");
            console.error("WebSocket connection timeout");
          }
        }, 10000);

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          setConnectionStatus("connected");
          ws.send(JSON.stringify({ type: "join", roomId, userName }));
        };

        ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case "offer": {
                if (!peerConnectionRef.current) return;
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.offer));
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "answer", answer, roomId }));
                }
                break;
              }
              case "answer": {
                if (!peerConnectionRef.current) return;
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.answer));
                break;
              }
              case "ice-candidate": {
                if (!peerConnectionRef.current || !message.candidate) return;
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
                break;
              }
              case "user-joined": {
                setConnectionStatus("peer-connected");
                if (isTutor && peerConnectionRef.current && ws.readyState === WebSocket.OPEN) {
                  setTimeout(async () => {
                    try {
                      const offer = await peerConnectionRef.current.createOffer();
                      await peerConnectionRef.current.setLocalDescription(offer);
                      ws.send(JSON.stringify({ type: "offer", offer, roomId }));
                    } catch (err) {
                      console.error("Error creating offer after peer joined:", err);
                    }
                  }, 500);
                }
                break;
              }
              case "user-left": {
                setConnectionStatus("peer-disconnected");
                break;
              }
              default:
                break;
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionStatus("error");
        };

        ws.onclose = () => {
          setConnectionStatus("disconnected");
        };

        // Create peer connection with ICE servers
        const pc = new RTCPeerConnection({ iceServers: getIceServers() });
        peerConnectionRef.current = pc;

        // Add local stream tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Remote stream handling
        pc.ontrack = (event) => {
          const [rStream] = event.streams;
          setRemoteStream(rStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = rStream;
          }
        };

        // ICE candidate handling
        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate, roomId }));
          }
        };

        // If tutor, create initial offer once connection stabilizes
        setTimeout(async () => {
          if (isTutor && ws.readyState === WebSocket.OPEN && peerConnectionRef.current) {
            try {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: "offer", offer, roomId }));
            } catch (err) {
              console.error("Error creating offer:", err);
            }
          }
        }, 1000);
      } catch (error) {
        console.error("Error initializing WebRTC:", error);
        setConnectionStatus("error");
      }
    };

    initializeWebRTC();

    // Cleanup everything when unmounting or roomId changes
    return () => {
      // Stop local tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        setLocalStream(null);
      }

      // Stop remote tracks
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        setRemoteStream(null);
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.getSenders().forEach((sender) => {
          if (sender.track) sender.track.stop();
        });
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Notify and close WebSocket
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "user-left", roomId }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear video refs
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = async () => {
    setConnectionStatus("ending");
    // trigger effect cleanup by closing ws and pc
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "user-left", roomId }));
      wsRef.current.close();
    }
    peerConnectionRef.current?.close();

    if (!isTutor && session && onSubmitFeedback) {
      setShowFeedback(true);
    } else {
      setTimeout(() => {
        onClose();
      }, 100);
    }
  };

  const handleFeedbackSubmit = async (feedback) => {
    if (onSubmitFeedback) {
      await onSubmitFeedback(feedback);
    }
    setShowFeedback(false);
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleFeedbackCancel = () => {
    setShowFeedback(false);
    setTimeout(() => {
      onClose();
    }, 100);
  };

  // Conditional render for feedback form
  if (showFeedback && session) {
    return (
      <FeedbackForm
        session={session}
        onSubmit={handleFeedbackSubmit}
        onCancel={handleFeedbackCancel}
        isTutor={isTutor}
      />
    );
  }

  // Main UI render
  return (
    <div className="video-call-overlay">
      <div className="video-call-container">
        <div className="video-call-header">
          <h3>Session: {roomId}</h3>
          <div className="connection-status">
            <span className={`status-dot ${connectionStatus}`}></span>
            <span>{connectionStatus}</span>
          </div>
          <button className="close-btn" onClick={handleEndCall}>
            ×
          </button>
        </div>

        <div className="video-call-content">
          <div className="remote-video-container">
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            ) : (
              <div className="waiting-for-peer">
                <div className="spinner"></div>
                <p>Waiting for {isTutor ? "student" : "tutor"} to join...</p>
              </div>
            )}
          </div>

          <div className="local-video-container">
            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
            <div className="video-label">{userName}</div>
          </div>
        </div>

        <div className="video-call-controls">
          <button
            className={`control-btn ${isMuted ? "muted" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "🔇" : "🎤"}
          </button>
          <button
            className={`control-btn ${isVideoOff ? "video-off" : ""}`}
            onClick={toggleVideo}
            title={isVideoOff ? "Turn on video" : "Turn off video"}
          >
            {isVideoOff ? "📵" : "📹"}
          </button>
          <button className="control-btn end-call" onClick={handleEndCall}>
            📞 End Call
          </button>
        </div>
      </div>
    </div>
  );
}

