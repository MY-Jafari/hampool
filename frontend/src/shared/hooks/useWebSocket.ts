import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface UseWebSocketOptions {
  onMessage?: (event: MessageEvent<string>) => void;
  enabled?: boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
}

/**
 * Builds standard relative-protocol WebSocket URL from window.location.
 * Never hardcodes localhost or ports. Adheres strictly to Docker rule §6.
 */
export function buildWebSocketUrl(path: string, token?: string | null): string {
  if (typeof window === 'undefined') return '';
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = `${protocol}//${loc.host}${cleanPath}`;
  if (!token) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

/**
 * Managed WebSocket hook featuring:
 * - Exponential backoff with random jitter (1s → 30s)
 * - Fresh JWT token acquisition on each reconnect
 * - Clean teardown and reconnection triggers
 * - Connection status reporting
 */
export function useWebSocket(path: string | null, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    enabled = true,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    maxRetries = 20,
  } = options;

  const [status, setStatus] = useState<SocketStatus>('closed');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const retryTimerRef = useRef<number | undefined>(undefined);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Normal closure');
      }
      wsRef.current = null;
    }
    setStatus('closed');
  }, []);

  useEffect(() => {
    if (!path || !enabled) {
      cleanup();
      return;
    }

    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      // Always pull fresh access token from store
      const token = useAuthStore.getState().access;
      if (!token) {
        setStatus('closed');
        return;
      }

      cleanup();

      const url = buildWebSocketUrl(path, token);
      setStatus('connecting');

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) return;
          attemptsRef.current = 0;
          setStatus('open');
        };

        ws.onmessage = (event) => {
          if (isDisposed) return;
          onMessageRef.current?.(event);
        };

        ws.onerror = () => {
          // onerror is typically followed by onclose
        };

        ws.onclose = (event) => {
          if (isDisposed) return;
          setStatus('closed');

          // If closed normally (1000) or unauthorized token (4001/4003), do not endlessly spin
          if (event.code === 1000 || event.code === 4001 || event.code === 4003) {
            return;
          }

          if (attemptsRef.current < maxRetries) {
            // Exponential backoff with jitter
            const exponential = Math.min(baseDelayMs * 2 ** attemptsRef.current, maxDelayMs);
            const jitter = Math.random() * 1000;
            const delay = Math.min(exponential + jitter, maxDelayMs);

            attemptsRef.current += 1;
            retryTimerRef.current = window.setTimeout(connect, delay);
          }
        };
      } catch {
        setStatus('closed');
      }
    };

    connect();

    return () => {
      isDisposed = true;
      cleanup();
    };
  }, [path, enabled, baseDelayMs, maxDelayMs, maxRetries, cleanup]);

  return {
    status,
    isConnected: status === 'open',
    isConnecting: status === 'connecting',
    isClosed: status === 'closed',
  };
}
