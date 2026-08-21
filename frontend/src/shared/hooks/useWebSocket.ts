import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';

export type SocketStatus = 'connecting' | 'open' | 'closed';

interface UseWebSocketOptions {
  onMessage: (event: MessageEvent<string>) => void;
  enabled?: boolean;
}

/**
 * Managed WebSocket connection: attaches the JWT as a query param,
 * auto-reconnects with exponential backoff (1s → 30s max).
 */
export function useWebSocket(path: string | null, options: UseWebSocketOptions): SocketStatus {
  const { onMessage, enabled = true } = options;
  const [status, setStatus] = useState<SocketStatus>('closed');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!path || !enabled) return;
    let disposed = false;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const token = useAuthStore.getState().access;
      if (!token) {
        setStatus('closed');
        return;
      }
      const sep = path.includes('?') ? '&' : '?';
      const ws = new WebSocket(`${path}${sep}token=${token}`);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus('open');
      };
      ws.onmessage = (event) => onMessageRef.current(event);
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        setStatus('closed');
        if (disposed) return;
        const delay = Math.min(1000 * 2 ** attemptsRef.current, 30_000);
        attemptsRef.current += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [path, enabled]);

  return status;
}
