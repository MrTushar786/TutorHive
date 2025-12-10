import Emitter from "./Emitter";

/**
 * MediaDevice - Manages user media streams (camera/microphone)
 * Provides methods to start, stop, and toggle media devices
 */
class MediaDevice extends Emitter {
  constructor() {
    super();
    this.stream = null;
  }

  /**
   * Start media devices and emit stream
   * @returns {Promise<MediaDevice>}
   */
  async start(options = {}) {
    const constraints = {
      video: options.video !== false ? {
        facingMode: "user",
        height: { min: 360, ideal: 720, max: 1080 },
        ...(typeof options.video === "object" ? options.video : {}),
      } : false,
      audio: options.audio !== false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;
      this.emit("stream", stream);
      return this;
    } catch (error) {
      if (error instanceof DOMException) {
        this.emit("error", new Error("Cannot open webcam and/or microphone. Please check permissions."));
      } else {
        this.emit("error", error);
      }
      throw error;
    }
  }

  /**
   * Turn on/off a media device
   * @param {'Audio' | 'Video'} type - Type of device
   * @param {Boolean} [on] - State of device (optional, toggles if not provided)
   */
  toggle(type, on) {
    if (!this.stream) return this;

    const tracks = this.stream[`get${type}Tracks`]();
    const state = arguments.length === 2 ? on : !tracks[0]?.enabled;

    tracks.forEach((track) => {
      track.enabled = state;
    });

    this.emit("device-toggled", { type, enabled: state });
    return this;
  }

  /**
   * Stop all media tracks
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    return this;
  }

  /**
   * Get current stream
   */
  getStream() {
    return this.stream;
  }
}

export default MediaDevice;

