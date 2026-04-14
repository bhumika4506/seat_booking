import { useState, useEffect, useRef } from 'react';
import { useToast } from './Toast';

export function useWebSocket(onMessageCallback) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket('ws://127.0.0.1:8001/ws');

      ws.current.onopen = () => {
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageCallback(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.current.close();
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [onMessageCallback]); // eslint-disable-line react-hooks/exhaustive-deps

  return isConnected;
}
