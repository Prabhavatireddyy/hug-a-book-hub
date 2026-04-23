import { randomUUID } from "node:crypto";

const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function createSession(user) {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    id: sessionId,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return sessionId;
}

export function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function updateSessionUser(sessionId, user) {
  const session = getSession(sessionId);
  if (!session) return null;
  const nextSession = {
    ...session,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(sessionId, nextSession);
  return nextSession;
}

export function deleteSession(sessionId) {
  if (!sessionId) return;
  sessions.delete(sessionId);
}
