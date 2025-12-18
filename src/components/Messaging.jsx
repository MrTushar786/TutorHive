import React, { useState, useEffect, useRef } from "react";
import "./Messaging.css";
import { createWSClient } from "../utils/wsClient";
import { ArrowLeft, MoreVertical, Edit2, Trash2, Check, X } from "lucide-react";
import { editMessage, deleteMessage } from "../api/messages";

function Messaging({ currentUser, token, conversations = [], onSendMessage, onDeleteConversation, onMarkAsRead, targetConversation, onMessageReceived, onSelectConversation }) {
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Auto-mark as read when conversation is selected/visible
  useEffect(() => {
    if (selectedConversation && onMarkAsRead && conversations.length > 0) {
      const activeConv = conversations.find(c => c.id === selectedConversation.id);
      if (activeConv && activeConv.unreadCount > 0) {
        onMarkAsRead(activeConv.id);
      }
    }
  }, [selectedConversation, conversations, onMarkAsRead]);

  useEffect(() => {
    if (targetConversation) {
      setSelectedConversation(targetConversation);
    }
  }, [targetConversation]);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);

  useEffect(() => {
    if (selectedConversation && currentUser?._id) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedConversation, currentUser?._id]);

  // Ref to track the *current* conversation ID for the WS callbacks
  const currentConvIdRef = useRef(null);

  useEffect(() => {
    // Only clear if we are genuinely switching to a new conversation
    if (selectedConversation && selectedConversation.id) {
      // Only clear if ID changed
      if (currentConvIdRef.current !== selectedConversation.id) {
        setMessages([]);
        setEditingMessageId(null);
        setMenuOpenId(null);
      }
      currentConvIdRef.current = selectedConversation.id;
    } else {
      currentConvIdRef.current = null;
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    // Click outside to close menu
    const handleClickOutside = (event) => {
      if (menuOpenId && !event.target.closest(".actions-popup") && !event.target.closest(".menu-trigger")) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  const connectWebSocket = () => {
    if (!selectedConversation || !currentUser?._id || !selectedConversation.id) return;

    // Capture the ID this socket is meant for
    const targetConvId = selectedConversation.id;

    if (wsRef.current) wsRef.current.close();

    wsRef.current = createWSClient({
      path: "/ws/messages",
      queryParams: {
        conversationId: targetConvId,
        userId: currentUser._id,
      },
      onOpen: () => setWsConnected(true),
      onMessage: (data) => {
        // CRITICAL GATING: Ignore if user switched conversation
        if (currentConvIdRef.current !== targetConvId) return;

        if (data.type === "messages") {
          setMessages(data.messages || []);
        } else if (data.type === "new-message") {
          setMessages((prev) => {
            // Deduplication Logic
            const newMsg = data.message;

            // 1. Prevent exact ID duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;

            // 2. Remove optimistic match (same text, same sender, temporary ID)
            const filtered = prev.filter(m =>
              !(m.id.startsWith("local-") && m.text === newMsg.text && m.sender === newMsg.sender)
            );

            return [...filtered, newMsg];
          });

          // Notify parent (dashboard) to refresh conversation list (e.g. bring to top, update preview)
          if (onMessageReceived) onMessageReceived(data.message);
        }
      },
      onError: () => setWsConnected(false),
      onClose: () => setWsConnected(false),
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation || !wsRef.current?.ready) return;

    const messageData = {
      type: "message",
      text: messageText,
      senderName: currentUser.name,
    };

    wsRef.current.send(messageData);

    // Optimistic append
    const localMessage = {
      id: `local-${Date.now()}`,
      text: messageText,
      sender: currentUser._id,
      senderName: currentUser.name,
      timestamp: new Date().toISOString(),
      isOptimistic: true
    };
    setMessages((prev) => [...prev, localMessage]);
    setMessageText("");

    if (onSendMessage) onSendMessage(selectedConversation.id, messageText);
  };

  const startEditing = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.text);
    setMenuOpenId(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await editMessage(editingMessageId, editText, token);
      setMessages((prev) =>
        prev.map((m) => (m.id === editingMessageId ? { ...m, text: editText, isEdited: true } : m))
      );
      setEditingMessageId(null);
    } catch (err) {
      console.error("Failed to edit message", err);
      alert("Failed to edit message");
    }
  };

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDanger: false,
  });

  const closeConfirmation = () => {
    setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
  };

  const showConfirmation = ({ title, message, onConfirm, isDanger = false }) => {
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        closeConfirmation();
      },
      isDanger,
    });
  };

  const handleDeleteMessage = (msgId, mode) => {
    setMenuOpenId(null);
    showConfirmation({
      title: "Delete Message?",
      message: mode === "everyone"
        ? "Are you sure you want to delete this message for everyone? This cannot be undone."
        : "Are you sure you want to delete this message just for you?",
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteMessage(msgId, mode, token);
          if (mode === "everyone") {
            setMessages((prev) =>
              prev.map((m) => (m.id === msgId ? { ...m, text: "This message was deleted", isDeleted: true } : m))
            );
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
          }
        } catch (err) {
          console.error("Failed to delete message", err);
          alert("Failed to delete message");
        }
      },
    });
  };

  // Scroll to bottom logic
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      if (isFirstLoadRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        isFirstLoadRef.current = false;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  return (
    <div className="messaging-container">
      {/* Conversations List (Hidden on mobile if chat is selected) */}
      <div className={`conversations-list ${selectedConversation ? "mobile-hidden" : ""}`}>
        <h3>Conversations</h3>
        <div className="conversations-scroll">
          {conversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedConversation(conv);
                  if (onSelectConversation) onSelectConversation(conv);
                }}
              >
                <div className="conversation-avatar">
                  {conv.avatar?.startsWith("data:") || conv.avatar?.startsWith("http") ? (
                    <img src={conv.avatar} alt={conv.name} />
                  ) : (
                    conv.avatar || "👤"
                  )}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{conv.name}</div>
                  <div className="conversation-preview">
                    {conv.lastMessage || <span className="no-messages">No messages yet</span>}
                  </div>
                </div>
                {conv.unreadCount > 0 && <div className="unread-badge">{conv.unreadCount}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area (Hidden on mobile if no chat selected, usually overlays list) */}
      <div className={`chat-area ${!selectedConversation ? "mobile-hidden" : "mobile-visible"}`}>
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <button
                className="back-button"
                onClick={() => {
                  setSelectedConversation(null);
                  if (onSelectConversation) onSelectConversation(null);
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="chat-header-avatar">
                {selectedConversation.avatar?.startsWith("data:") || selectedConversation.avatar?.startsWith("http") ? (
                  <img src={selectedConversation.avatar} alt={selectedConversation.name} />
                ) : (
                  selectedConversation.avatar || "👤"
                )}
              </div>
              <div className="chat-header-info">
                <div className="chat-header-name">{selectedConversation.name}</div>
                <div className={`chat-header-status ${wsConnected ? "online" : "offline"}`}>
                  {wsConnected ? "Online" : "Connnecting..."}
                </div>
              </div>
              <div className="chat-header-actions">
                <button
                  className="icon-btn danger"
                  title="Delete Chat"
                  onClick={() => {
                    showConfirmation({
                      title: "Delete Conversation?",
                      message: "Are you sure you want to delete this conversation? This will hide it from your list.",
                      isDanger: true,
                      onConfirm: () => {
                        onDeleteConversation(selectedConversation.id);
                        setSelectedConversation(null);
                        if (onSelectConversation) onSelectConversation(null);
                      }
                    });
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="messages-list">
              {messages.map((message, index) => {
                const isOwn = message.sender === currentUser._id;
                const showMenu = menuOpenId === message.id;
                const isSystem = message.isDeleted;
                const isNearBottom = index >= messages.length - 2;

                return (
                  <div key={message.id} className={`message ${isOwn ? "own" : "other"} ${isSystem ? "system" : ""}`}>
                    <div className="message-content-wrapper">
                      {/* Message Content or Edit Form */}
                      <div className="message-content">
                        {editingMessageId === message.id ? (
                          <div className="edit-form">
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              autoFocus
                            />
                            <div className="edit-actions">
                              <button onClick={saveEdit} className="save-btn"><Check size={14} /></button>
                              <button onClick={cancelEditing} className="cancel-btn"><X size={14} /></button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="message-text">
                              {message.text}
                              {message.isEdited && <span className="edited-tag">(edited)</span>}
                            </div>
                            <div className="message-time">
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Actions Menu Trigger (only for valid messages) */}
                      {!isSystem && !editingMessageId && (
                        <div className="message-actions">
                          <button
                            className="menu-trigger"
                            onClick={() => setMenuOpenId(showMenu ? null : message.id)}
                          >
                            <MoreVertical size={14} />
                          </button>
                          {showMenu && (
                            <div className={`actions-popup ${isNearBottom ? "popup-up" : ""}`}>
                              {isOwn && (
                                <button onClick={() => startEditing(message)}>
                                  <Edit2 size={14} /> Edit
                                </button>
                              )}
                              {isOwn && (
                                <button onClick={() => handleDeleteMessage(message.id, "everyone")} className="delete-action">
                                  <Trash2 size={14} /> Delete for Everyone
                                </button>
                              )}
                              <button onClick={() => handleDeleteMessage(message.id, "me")} className="delete-action">
                                <Trash2 size={14} /> Delete for Me
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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
              <button type="submit" className="send-button" disabled={!messageText.trim()}>
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

      {confirmationModal.isOpen && (
        <div className="modal-overlay" onClick={closeConfirmation}>
          <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmationModal.title}</h3>
            <p>{confirmationModal.message}</p>
            <div className="confirm-modal-actions">
              <button className="modal-btn secondary" onClick={closeConfirmation}>
                Cancel
              </button>
              <button
                className={`modal-btn ${confirmationModal.isDanger ? "danger" : "primary"}`}
                onClick={() => {
                  confirmationModal.onConfirm();
                  closeConfirmation();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messaging;
