import React, { useState, useEffect, useRef } from "react";
import "./Messaging.css";
import { createWSClient } from "../utils/wsClient";

// Messaging component
function Messaging({ currentUser, token, conversations = [], onSendMessage, onDeleteConversation, onMarkAsRead }) {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (selectedConversation && currentUser?._id) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedConversation, currentUser?._id]);

  // Clear messages when switching conversations
  useEffect(() => {
    setMessages([]);
  }, [selectedConversation?.id]);

  const connectWebSocket = () => {
    if (!selectedConversation || !currentUser?._id || !selectedConversation.id) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    // Connect to dedicated messaging endpoint with required params
    wsRef.current = createWSClient({
      path: "/ws/messages",
      queryParams: {
        conversationId: selectedConversation.id, // already "conv-<a>-<b>"
        userId: currentUser._id,
      },
      onOpen: () => setWsConnected(true),
      onMessage: (data) => {
        if (data.type === "messages") {
          setMessages(data.messages || []);
        } else if (data.type === "new-message") {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === "message" && data.text) {
          // Fallback support if the server ever echoes plain "message" events
          setMessages((prev) => [
            ...prev,
            {
              id: `remote-${Date.now()}`,
              text: data.text,
              sender: data.senderId,
              senderName: data.senderName,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      },
      onError: () => setWsConnected(false),
      onClose: (event) => {
        setWsConnected(false);
        if (event.code === 1008) {
          console.warn("WebSocket closed due to invalid params. Check conversationId/userId.");
          return;
        }
      },
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation || !wsRef.current?.ready) return;

    // /ws/messages relies on connection context; roomId is not needed
    const messageData = {
      type: "message",
      text: messageText,
      senderName: currentUser.name,
    };

    wsRef.current.send(messageData);

    // Optimistic local append
    const localMessage = {
      id: `local-${Date.now()}`,
      text: messageText,
      sender: currentUser._id,
      senderName: currentUser.name,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localMessage]);
    setMessageText("");
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteConversation = (convId) => {
    if (!convId || typeof onDeleteConversation !== "function") return;
    const ok = window.confirm("Delete this chat? This will remove it from your list.");
    if (!ok) return;
    onDeleteConversation(convId);
    if (selectedConversation?.id === convId) {
      setSelectedConversation(null);
      setMessages([]);
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
  };

  return (
    <div className="messaging-container">
      <div className="conversations-list">
        <h3>Conversations</h3>
        {conversations.length === 0 ? (
          <div className="empty-state">
            <p>No conversations yet</p>
            <p className="empty-hint">Start chatting with your {currentUser.role === "tutor" ? "students" : "tutors"}!</p>
          </div>
        ) : (
          <div className="conversations">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedConversation(conv);
                  if (conv.unreadCount > 0 && onMarkAsRead) {
                    onMarkAsRead(conv.id);
                  }
                }}
              >
                <div className="conversation-avatar">
                  {conv.avatar?.startsWith("data:") || conv.avatar?.startsWith("http") ? (
                    <img src={conv.avatar} alt={conv.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    conv.avatar || "👤"
                  )}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{conv.name}</div>
                  <div className="conversation-preview">
                    {conv.lastMessage || "No messages yet"}
                  </div>
                </div>
                {conv.unreadCount > 0 && selectedConversation?.id !== conv.id && (
                  <div className="unread-badge">{conv.unreadCount}</div>
                )}
                {/* Delete chat button on list item */}
                <button
                  type="button"
                  className="conversation-delete-btn"
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chat-area">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-header-avatar">
                {selectedConversation.avatar?.startsWith("data:") || selectedConversation.avatar?.startsWith("http") ? (
                  <img src={selectedConversation.avatar} alt={selectedConversation.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  selectedConversation.avatar || "👤"
                )}
              </div>
              <div className="chat-header-info">
                <div className="chat-header-name">{selectedConversation.name}</div>
                <div className={`chat-header-status ${wsConnected ? "online" : "offline"}`}>
                  {wsConnected ? "Online" : "Connecting..."}
                </div>
              </div>
              {/* Delete chat button in header */}
              <button
                type="button"
                className="chat-delete-btn"
                title="Delete chat"
                onClick={() => handleDeleteConversation(selectedConversation.id)}
              >
                🗑️ Delete Chat
              </button>
            </div>

            <div className="messages-list">
              {messages.map((message) => {
                const isOwn = message.sender === currentUser._id;
                return (
                  <div key={message.id} className={`message ${isOwn ? "own" : "other"}`}>
                    <div className="message-content">
                      <div className="message-text">{message.text}</div>
                      <div className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form className="message-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="message-input"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <button type="submit" className="send-button" disabled={!messageText.trim() || !wsConnected}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-conversation-selected">
            <div className="no-conversation-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the list to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messaging;

