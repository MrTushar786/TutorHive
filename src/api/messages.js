import { apiRequest } from "./client";

export async function getConversations(token) {
    return apiRequest("/messages/conversations", { token });
}
