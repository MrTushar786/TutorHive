
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import PeerConnection from "../utils/PeerConnection";
import FeedbackForm from "../components/FeedbackForm";
import { initVideoSocket, getVideoSocket, joinBookingRoom, disconnectVideoSocket } from "../utils/videoSocket";
import "./VideoCallPage.css";

// Effect to set local video stream when available
function useLocalVideoStream(videoRef, stream) {
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error("Error playing local video:", err);
      });
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [videoRef, stream]);
}

// Effect to set remote video stream when available
function useRemoteVideoStream(videoRef, stream) {
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error("Error playing remote video:", err);
      });
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [videoRef, stream]);
}

/**
 * VideoCallPage - Enterprise-grade video call component
 * Handles WebRTC peer connection, media management, and Socket.IO signaling
 */
export default function VideoCallPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [error, setError] = useState(null);
  const [roomJoined, setRoomJoined] = useState(false);

  // Use effects to handle video stream assignment
  useLocalVideoStream(localVideoRef, localStream);
  useRemoteVideoStream(remoteVideoRef, remoteStream);

  // Initialize socket and join room
  useEffect(() => {
    if (!bookingId || !user || !token) {
      setError("Missing booking ID or authentication");
      return;
    }

    const role = user.role; // student or tutor
    const isCaller = role === "tutor"; // Tutor initiates the call

    let mounted = true;

    // Initialize socket
    const socket = initVideoSocket(token);
    socketRef.current = socket;

    // Wait for connection before setting up handlers
    const setupConnection = async () => {
      try {
        // Wait for socket to connect
        await new Promise((resolve, reject) => {
          if (socket.connected) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout. Please ensure the server is running."));
          }, 15000);

          socket.once("connect", () => {
            clearTimeout(timeout);
            resolve();
          });

          socket.once("connect_error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        if (!mounted) return;

        // Initialize peer connection first
        const pc = new PeerConnection(bookingId, {
          isCaller,
          socket,
        });

        peerConnectionRef.current = pc;

        // Handle local stream
        pc.on("localStream", (stream) => {
          if (mounted) {
            console.log("Local stream received");
            setLocalStream(stream);
          }
        });

        // Handle remote stream
        pc.on("peerStream", (stream) => {
          if (mounted) {
            console.log("Remote stream received");
            setRemoteStream(stream);
            setConnectionStatus("peer-connected");
          }
        });

        // Handle connection state changes
        pc.on("connectionStateChange", (state) => {
          if (mounted) {
            console.log("Connection state:", state);
            setConnectionStatus(state);
          }
        });

        pc.on("iceConnectionStateChange", (state) => {
          if (mounted) {
            console.log("ICE connection state:", state);
            if (state === "connected") {
              setConnectionStatus("connected");
            } else if (state === "failed") {
              setConnectionStatus("failed");
              setError("Connection failed. Please try again.");
            }
          }
        });

        pc.on("error", (err) => {
          if (mounted) {
            setError(err.message);
            console.error("PeerConnection error:", err);
          }
        });

        // Setup socket event handlers
        const setupSocketHandlers = () => {
          // Handle room joined
          socket.on("room-joined", (data) => {
            if (data.bookingId === bookingId && mounted) {
              setRoomJoined(true);
              setConnectionStatus("connected");
              console.log("Room joined, starting media...");

              // Start call after room is joined
              console.log("Starting media devices...");
              pc.start({ video: true, audio: true })
                .then(() => {
                  console.log("Media devices started successfully");
                })
                .catch((err) => {
                  if (mounted) {
                    setError(err.message || "Failed to access camera/microphone. Please check permissions.");
                    console.error("Failed to start media:", err);
                  }
                });
            }
          });

          // Handle WebRTC offer
          socket.on("call-offer", async (data) => {
            const userId = user._id || user.id;
            if (data.from === userId) {
              console.log("Ignoring own offer");
              return;
            }

            console.log("Received offer from:", data.from, "for booking:", data.bookingId);
            const currentPc = peerConnectionRef.current;
            if (currentPc && data.offer) {
              try {
                console.log("Setting remote description (offer)...");
                await currentPc.setRemoteDescription(data.offer);
                console.log("Creating answer...");
                await currentPc.createAnswer();
                console.log("Answer created and sent");
              } catch (err) {
                console.error("Error handling offer:", err);
                if (mounted) {
                  setError("Failed to handle call offer: " + err.message);
                }
              }
            } else {
              console.error("No peer connection or offer data:", { hasPc: !!currentPc, hasOffer: !!data.offer });
            }
          });

          // Handle WebRTC answer
          socket.on("call-answer", async (data) => {
            const userId = user._id || user.id;
            if (data.from === userId) {
              console.log("Ignoring own answer");
              return;
            }

            console.log("Received answer from:", data.from, "for booking:", data.bookingId);
            const currentPc = peerConnectionRef.current;
            if (currentPc && data.answer) {
              try {
                console.log("Setting remote description (answer)...");
                await currentPc.setRemoteDescription(data.answer);
                console.log("Remote description set from answer");
              } catch (err) {
                console.error("Error handling answer:", err);
                if (mounted) {
                  setError("Failed to handle call answer: " + err.message);
                }
              }
            } else {
              console.error("No peer connection or answer data:", { hasPc: !!currentPc, hasAnswer: !!data.answer });
            }
          });

          // Handle ICE candidates
          socket.on("ice-candidate", async (data) => {
            const userId = user._id || user.id;
            if (data.from === userId) {
              return; // Ignore own candidates
            }

            const currentPc = peerConnectionRef.current;
            if (currentPc && data.candidate) {
              try {
                await currentPc.addIceCandidate(data.candidate);
                console.log("Added ICE candidate");
              } catch (err) {
                console.error("Error adding ICE candidate:", err);
              }
            }
          });

          // Handle call ended
          socket.on("call-ended", () => {
            handleEndCall();
          });

          // Handle user joined/left
          socket.on("user-joined", (data) => {
            console.log("User joined:", data);
          });

          socket.on("user-left", (data) => {
            console.log("User left:", data);
            if (connectionStatus === "peer-connected") {
              setConnectionStatus("peer-disconnected");
            }
          });

          // Handle errors
          socket.on("error", (error) => {
            if (mounted) {
              setError(error.message || "Socket error occurred");
            }
          });
        };

        setupSocketHandlers();

        // Join room after connection is established
        await joinBookingRoom(
          bookingId,
          role,
          (data) => {
            if (mounted) {
              console.log("Room joined:", data);
            }
          },
          (err) => {
            if (mounted) {
              setError(err.message || "Failed to join room");
              console.error("Failed to join room:", err);
            }
          }
        );
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to connect to video server. Please check if the server is running on port 5000.");
          console.error("Error setting up connection:", err);
        }
      }
    };

    setupConnection();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (peerConnectionRef.current) {
        peerConnectionRef.current.stop(false);
        peerConnectionRef.current = null;
      }
      if (socket) {
        socket.off("room-joined");
        socket.off("call-offer");
        socket.off("call-answer");
        socket.off("ice-candidate");
        socket.off("call-ended");
        socket.off("user-joined");
        socket.off("user-left");
        socket.off("error");
        socket.off("connect");
        socket.off("connect_error");
      }
    };
  }, [bookingId, user, token]);

  const toggleMute = () => {
    if (peerConnectionRef.current) {
      const mediaDevice = peerConnectionRef.current.getMediaDevice();
      mediaDevice.toggle("Audio");
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (peerConnectionRef.current) {
      const mediaDevice = peerConnectionRef.current.getMediaDevice();
      mediaDevice.toggle("Video");
      setIsVideoOff(!isVideoOff);
    }
  };

  const [showFeedback, setShowFeedback] = useState(false);

  const handleEndCall = async (endedByUser = false) => {
    // 1. Stop Media & Connection
    if (peerConnectionRef.current) {
      const isCaller = user.role === "tutor";
      peerConnectionRef.current.stop(isCaller);
      peerConnectionRef.current = null;
    }
    disconnectVideoSocket();

    // 2. Mark session as completed in backend (if user initiated end)
    if (endedByUser) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        await fetch(`${apiUrl}/api/bookings/${bookingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ status: "completed" })
        });
      } catch (err) {
        console.error("Failed to mark session completed:", err);
      }
    }

    // 3. Navigate or Show Feedback
    if (user.role === "student") {
      setShowFeedback(true);
    } else {
      navigate("/tutordashboard");
    }
  };

  const handleFeedbackSubmit = async (data) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          rating: data.rating,
          comment: data.comment
        })
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      navigate("/studentdashboard");
    } catch (err) {
      console.error("Feedback error:", err);
      alert("Failed to submit feedback, but session is ended.");
      navigate("/studentdashboard");
    }
  };

  if (error && !roomJoined) {
    return (
      <div className="video-call-error">
        <div className="error-content">
          <h2>Unable to Join Call</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-page">
      <div className="video-call-container">
        {/* Header */}
        <div className="video-call-header">
          <div className="call-info">
            <h3>Video Call - Booking {bookingId?.slice(-8)}</h3>
            <div className="connection-status">
              <span className={`status-dot ${connectionStatus}`}></span>
              <span className="status-text">
                {connectionStatus === "connecting" && "Connecting..."}
                {connectionStatus === "connected" && "Connected"}
                {connectionStatus === "peer-connected" && "In Call"}
                {connectionStatus === "failed" && "Connection Failed"}
                {connectionStatus === "peer-disconnected" && "Peer Disconnected"}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={handleEndCall} title="End Call">
            ×
          </button>
        </div>

        {/* Video Content */}
        <div className="video-call-content">
          {/* Remote Video */}
          <div className="remote-video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />
            {!remoteStream && (
              <div className="waiting-for-peer">
                <div className="spinner"></div>
                <p>Waiting for {user.role === "student" ? "tutor" : "student"} to join...</p>
              </div>
            )}
          </div>

          {/* Local Video - Always render so ref works */}
          <div className="local-video-container" style={{ display: 'block', opacity: localStream ? 1 : 0.5 }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
              onLoadedMetadata={() => console.log("Local video metadata loaded")}
            />
            {localStream && (
              <div className="video-label">{user.name || user.email}</div>
            )}
            {!localStream && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'rgba(0,0,0,0.5)' }}>Loading Camera...</div>}
          </div>
        </div>

        {/* Controls */}
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
          <button className="control-btn end-call" onClick={() => handleEndCall(true)} title="End Call">
            📞 End Call
          </button>
        </div>

        {/* Feedback Modal */}
        {showFeedback && (
          <FeedbackForm
            session={{ id: bookingId, tutor: "Tutor", student: "Student" }} // Names could be improved if passed in props or fetched
            isTutor={user.role === "tutor"}
            onSubmit={handleFeedbackSubmit}
            onCancel={() => navigate(user.role === "student" ? "/studentdashboard" : "/tutordashboard")}
          />
        )}
      </div>
    </div>
  );
}

