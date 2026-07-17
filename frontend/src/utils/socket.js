import { io } from "socket.io-client";
import { getAccessToken } from "./auth";

let socket = null;
const socketListeners = new Set();

const notifySocketListeners = (newSocket) => {
  socketListeners.forEach((listener) => {
    try {
      listener(newSocket);
    } catch (err) {
      console.warn("Error in socket change listener callback:", err);
    }
  });
};

export const onSocketChange = (listener) => {
  socketListeners.add(listener);
  // Return cleanup function
  return () => {
    socketListeners.delete(listener);
  };
};

export const connectSocket = () => {
  const token = getAccessToken();

  // ✅ MUST HAVE THIS
  if (!token) return;

  // ✅ reset socket for fresh token
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("http://localhost:5001", {
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket connect error:", err.message);
  });

  notifySocketListeners(socket);
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  notifySocketListeners(null);
};

export const getSocket = () => socket;