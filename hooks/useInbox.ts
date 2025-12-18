import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/lib/api/client';
import type { InboxMessageData } from '@shared/index';

type InboxState = {
  messages: InboxMessageData[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
};

type UseInboxReturn = InboxState & {
  refresh: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
};

const POLL_INTERVAL = 30000; // Poll every 30 seconds for unread count

export function useInbox(): UseInboxReturn {
  const { call } = useApi();
  const [state, setState] = useState<InboxState>({
    messages: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
  });

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await call<{ messages: InboxMessageData[]; unreadCount: number }>('/v1/inbox');
      if (isMountedRef.current) {
        setState({
          messages: data.messages,
          unreadCount: data.unreadCount,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch inbox',
        }));
      }
    }
  }, [call]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await call<{ count: number }>('/v1/inbox/unread-count');
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          unreadCount: data.count,
        }));
      }
    } catch {
      // Silently fail on count polling - not critical
    }
  }, [call]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchInbox();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchInbox]);

  // Poll for unread count
  useEffect(() => {
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const markAsRead = useCallback(
    async (messageId: string) => {
      try {
        const data = await call<{ message: InboxMessageData }>(`/v1/inbox/${messageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isRead: true }),
        });

        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === messageId ? data.message : msg
            ),
            unreadCount: Math.max(0, prev.unreadCount - 1),
          }));
        }
      } catch (err) {
        console.error('Failed to mark message as read:', err);
        throw err;
      }
    },
    [call]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await call('/v1/inbox/read-all', { method: 'POST' });

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) => ({
            ...msg,
            isRead: true,
            readAt: new Date().toISOString(),
          })),
          unreadCount: 0,
        }));
      }
    } catch (err) {
      console.error('Failed to mark all messages as read:', err);
      throw err;
    }
  }, [call]);

  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await call(`/v1/inbox/${messageId}`, { method: 'DELETE' });

        if (isMountedRef.current) {
          setState((prev) => {
            const deletedMessage = prev.messages.find((msg) => msg.id === messageId);
            return {
              ...prev,
              messages: prev.messages.filter((msg) => msg.id !== messageId),
              unreadCount: deletedMessage && !deletedMessage.isRead
                ? Math.max(0, prev.unreadCount - 1)
                : prev.unreadCount,
            };
          });
        }
      } catch (err) {
        console.error('Failed to delete message:', err);
        throw err;
      }
    },
    [call]
  );

  return {
    ...state,
    refresh: fetchInbox,
    markAsRead,
    markAllAsRead,
    deleteMessage,
  };
}

/**
 * Lightweight hook that only tracks unread count (for badge display)
 */
export function useInboxUnreadCount(): { count: number; isLoading: boolean } {
  const { call } = useApi();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const data = await call<{ count: number }>('/v1/inbox/unread-count');
      if (isMountedRef.current) {
        setCount(data.count);
        setIsLoading(false);
      }
    } catch {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [call]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCount();

    const interval = setInterval(fetchCount, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchCount]);

  return { count, isLoading };
}
