import { TypingIndicator } from '@/features/chat/types';
import { publishToChannel } from '@/lib/tunnel/publisher';

const TYPING_TIMEOUT_MS = 5000;

type TypingEntry = {
  userName: string;
  expiresAt: number;
};

const typingByConversation = new Map<string, Map<string, TypingEntry>>();

function getConversationMap(conversationId: string): Map<string, TypingEntry> {
  let map = typingByConversation.get(conversationId);
  if (!map) {
    map = new Map();
    typingByConversation.set(conversationId, map);
  }
  return map;
}

function pruneExpired(conversationId: string): Map<string, TypingEntry> {
  const map = getConversationMap(conversationId);
  const now = Date.now();
  for (const [userId, entry] of map.entries()) {
    if (entry.expiresAt <= now) {
      map.delete(userId);
    }
  }
  if (map.size === 0) {
    typingByConversation.delete(conversationId);
  }
  return map;
}

export class TypingService {
  async updateTypingStatus(
    conversationId: string,
    userId: string,
    userName: string,
    isTyping: boolean,
  ): Promise<void> {
    const map = getConversationMap(conversationId);

    if (isTyping) {
      map.set(userId, {
        userName,
        expiresAt: Date.now() + TYPING_TIMEOUT_MS,
      });
    } else {
      map.delete(userId);
      if (map.size === 0) {
        typingByConversation.delete(conversationId);
      }
    }

    try {
      await publishToChannel(`conversation:${conversationId}`, 'typing:update', {
        userId,
        userName,
        isTyping,
      });
    } catch (error) {
      console.warn(`Failed to publish typing:update for conversation:${conversationId}`, error);
    }
  }

  async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
    const map = pruneExpired(conversationId);
    const now = Date.now();

    return [...map.entries()].map(([userId, entry]) => ({
      conversationId,
      userId,
      userName: entry.userName,
      timestamp: new Date(entry.expiresAt - TYPING_TIMEOUT_MS),
    })).filter((indicator) => {
      const entry = map.get(indicator.userId);
      return entry != null && entry.expiresAt > now;
    });
  }

  async cleanupTypingIndicators(conversationId: string): Promise<void> {
    pruneExpired(conversationId);
  }

  async stopTyping(conversationId: string, userId: string): Promise<void> {
    const map = getConversationMap(conversationId);
    const entry = map.get(userId);
    map.delete(userId);
    if (map.size === 0) {
      typingByConversation.delete(conversationId);
    }

    if (entry) {
      try {
        await publishToChannel(`conversation:${conversationId}`, 'typing:update', {
          userId,
          userName: entry.userName,
          isTyping: false,
        });
      } catch (error) {
        console.warn(`Failed to publish typing stop for conversation:${conversationId}`, error);
      }
    }
  }
}
