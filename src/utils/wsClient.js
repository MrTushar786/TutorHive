export function createWSClient({
  path = "/ws",
  roomId, // e.g., "room-abc123" for video, "conv-<conversationId>" for messaging
  onOpen,
  onMessage,
  onError,
  onClose,
  autoReconnect = true,
  reconnectDelayMs = 3000,
  queryParams, // NEW: optional query params for endpoints like /ws/messages
}) {
  if (!roomId && !queryParams) {
    throw new Error("wsClient: roomId or queryParams is required");
  }

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

  // Build URL with either queryParams or roomId
  const params = new URLSearchParams();
  if (queryParams && typeof queryParams === "object") {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
  } else {
    // Keep compatibility with /ws room handler
    params.append("roomId", String(roomId));
  }

  const url = `${wsBase}${path}?${params.toString()}`;
  let ws;

  const connect = () => {
    ws = new WebSocket(url);

    ws.onopen = () => {
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (error) {
        console.error("wsClient: parse error", error);
      }
    };

    ws.onerror = (error) => {
      onError?.(error);
    };

    ws.onclose = (event) => {
      onClose?.(event);
      // Do not auto-reconnect on policy violation
      if (autoReconnect && event.code !== 1008) {
        setTimeout(() => connect(), reconnectDelayMs);
      }
    };
  };

  connect();

  return {
    send: (payload) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(payload));
      return true;
    },
    close: () => {
      if (ws) ws.close();
    },
    get ready() {
      return ws?.readyState === WebSocket.OPEN;
    },
  };
}