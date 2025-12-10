import MediaDevice from "./MediaDevice";
import Emitter from "./Emitter";
import { getIceServers } from "../hooks/useIceServers";

/**
 * PeerConnection - Manages WebRTC peer connection
 * Handles offer/answer exchange, ICE candidates, and media streams
 */
class PeerConnection extends Emitter {
  /**
   * Create a PeerConnection
   * @param {String} bookingId - Booking ID for the call
   * @param {Object} options - Configuration options
   */
  constructor(bookingId, options = {}) {
    super();
    this.bookingId = bookingId;
    this.pc = null;
    this.mediaDevice = new MediaDevice();
    this.isCaller = options.isCaller || false;
    this.socket = options.socket;
    this.setupPeerConnection();
  }

  /**
   * Setup RTCPeerConnection with ICE servers
   */
  setupPeerConnection() {
    const iceServers = getIceServers();
    
    this.pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.socket.connected) {
        console.log("Sending ICE candidate");
        this.socket.emit("ice-candidate", {
          bookingId: this.bookingId,
          candidate: event.candidate,
        });
      } else if (event.candidate) {
        console.log("ICE candidate generated but socket not connected");
      }
    };

    // Handle remote stream
    this.pc.ontrack = (event) => {
      console.log("ontrack event received:", event.track.kind);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        console.log("Emitting peerStream with", remoteStream.getTracks().length, "tracks");
        this.emit("peerStream", remoteStream);
      }
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      this.emit("connectionStateChange", this.pc.connectionState);
      
      if (this.pc.connectionState === "failed") {
        this.emit("error", new Error("Connection failed"));
      }
    };

    // Handle ICE connection state
    this.pc.oniceconnectionstatechange = () => {
      this.emit("iceConnectionStateChange", this.pc.iceConnectionState);
    };
  }

  /**
   * Start the call
   * @param {Object} mediaOptions - Media constraints
   */
  async start(mediaOptions = {}) {
    try {
      console.log("Starting media devices...");
      // Start media device
      await this.mediaDevice.start(mediaOptions);

      // Wait for stream
      return new Promise((resolve, reject) => {
        this.mediaDevice.on("stream", async (stream) => {
          console.log("Media stream obtained, adding tracks to peer connection");
          
          // Add tracks to peer connection
          stream.getTracks().forEach((track) => {
            console.log(`Adding track: ${track.kind}, enabled: ${track.enabled}`);
            this.pc.addTrack(track, stream);
          });
          
          this.emit("localStream", stream);
          
          // If caller, create offer after tracks are added
          if (this.isCaller) {
            // Wait a bit for tracks to be properly added
            setTimeout(async () => {
              try {
                console.log("Caller: Creating offer...");
                await this.createOffer();
                resolve(this);
              } catch (err) {
                console.error("Error creating offer:", err);
                this.emit("error", err);
                reject(err);
              }
            }, 1000);
          } else {
            resolve(this);
          }
        });

        this.mediaDevice.on("error", (error) => {
          console.error("Media device error:", error);
          this.emit("error", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error("Error starting media:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Stop the call
   * @param {Boolean} isStarter - Whether this user started the call
   */
  stop(isStarter = false) {
    if (isStarter && this.socket) {
      this.socket.emit("end-call", { bookingId: this.bookingId });
    }

    this.mediaDevice.stop();
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.off();
    return this;
  }

  /**
   * Create WebRTC offer
   */
  async createOffer() {
    try {
      const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
      
      await this.pc.setLocalDescription(offer);
      
      if (this.socket) {
        this.socket.emit("call-offer", {
          bookingId: this.bookingId,
          offer,
        });
      }
      
      return this;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Create WebRTC answer
   */
  async createAnswer() {
    try {
      console.log("Creating WebRTC answer...");
      const answer = await this.pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      console.log("Setting local description (answer)...");
      await this.pc.setLocalDescription(answer);
      
      if (this.socket && this.socket.connected) {
        console.log("Sending answer to peer...");
        this.socket.emit("call-answer", {
          bookingId: this.bookingId,
          answer,
        });
      } else {
        console.error("Socket not connected, cannot send answer");
      }
      
      return this;
    } catch (error) {
      console.error("Error creating answer:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Set remote description (offer or answer)
   * @param {RTCSessionDescriptionInit} sdp - Session description
   */
  async setRemoteDescription(sdp) {
    try {
      const rtcSdp = new RTCSessionDescription(sdp);
      await this.pc.setRemoteDescription(rtcSdp);
      return this;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   * @param {RTCIceCandidateInit} candidate - ICE candidate
   */
  async addIceCandidate(candidate) {
    if (candidate && this.pc) {
      try {
        const iceCandidate = new RTCIceCandidate(candidate);
        await this.pc.addIceCandidate(iceCandidate);
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
    return this;
  }

  /**
   * Get media device instance
   */
  getMediaDevice() {
    return this.mediaDevice;
  }

  /**
   * Get peer connection state
   */
  getConnectionState() {
    return this.pc?.connectionState || "closed";
  }
}

export default PeerConnection;

