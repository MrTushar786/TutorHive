// Deterministic conversation ID between two users to ensure both join the same chat.
// Use this in StudentDashboard and TutorDashboard when building conversations list.
export function getConversationId(a, b) {
  if (!a || !b) return "";
  const [x, y] = [String(a), String(b)].sort();
  return `conv-${x}-${y}`;
}