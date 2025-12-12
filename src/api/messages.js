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
