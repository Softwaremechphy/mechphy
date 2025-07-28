// utils/websocket.js
export const createWebSocket = (url, onMessage, onError) => {
  let ws = null;
  let reconnectTimeout = null;
  let isConnected = false;

  const connect = () => {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`Connected to ${url}`);
      isConnected = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        onMessage(event);
      } catch (error) {
        console.error('Error processing message:', error);
        if (onError) onError(error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      if (onError) onError(error);
    };

    ws.onclose = () => {
      console.warn('WebSocket closed. Attempting to reconnect...');
      isConnected = false;
      
      // Attempt to reconnect after 5 seconds
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          connect();
          reconnectTimeout = null;
        }, 5000);
      }
    };
  };

  // Initial connection
  connect();

  // Return methods to interact with the WebSocket
  return {
    close: () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    },
    isConnected: () => isConnected,
    send: (data) => {
      if (ws && isConnected) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      }
    }
  };
};