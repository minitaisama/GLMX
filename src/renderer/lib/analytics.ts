let currentUserId: string | null = null
export async function initAnalytics() {}
export function capture(_eventName: string, _properties?: Record<string, any>) {}
export function identify(
  userId: string,
  _traits?: Record<string, any>,
) {
  currentUserId = userId
}
export function getCurrentUserId(): string | null {
  return currentUserId
}
export function reset() {
  currentUserId = null
}
export function shutdown() {}
export function trackMessageSent(data: {
  workspaceId: string
  messageLength: number
  mode: "plan" | "agent"
}) {
  void data
}
