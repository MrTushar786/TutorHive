import { apiRequest } from "./client";

export async function getConversations(token) {
    return apiRequest("/messages/conversations", { token });
}

export async function markAsRead(conversationId, token) {
    return apiRequest("/messages/mark-read", {
        method: "POST",
        data: { conversationId },
        token
    });
}

export async function deleteChat(conversationId, token) {
    return apiRequest(`/messages/conversations/${conversationId}`, {
        method: "DELETE",
        token
    });
}

export async function editMessage(messageId, text, token) {
    return apiRequest(`/messages/${messageId}`, {
        method: "PATCH",
        data: { text },
        token
    });
}

export async function deleteMessage(messageId, mode, token) {
    return apiRequest(`/messages/${messageId}?mode=${mode}`, {
        method: "DELETE",
        token
    });
}
