// Returns ICE servers for WebRTC; configurable via VITE_ICE_SERVERS
// Example VITE_ICE_SERVERS:
// [
//   { "urls": "stun:stun.l.google.com:19302" },
//   { "urls": "turn:turn.yourdomain.com:3478", "username": "user", "credential": "pass" }
// ]
export function getIceServers() {
  let iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  try {
    const iceEnv = import.meta.env.VITE_ICE_SERVERS;
    if (iceEnv) {
      const parsed = JSON.parse(iceEnv);
      if (Array.isArray(parsed) && parsed.length > 0) {
        iceServers = parsed;
      } else {
        console.warn("VITE_ICE_SERVERS is present but not a non-empty array. Falling back to STUN.");
      }
    }
  } catch (e) {
    console.warn("Invalid VITE_ICE_SERVERS JSON. Falling back to STUN.", e);
  }
  return iceServers;
}