import { io } from "socket.io-client";
import { getAccessToken } from "./auth";

let socket = null;

export const connectSocket = () => {
  const token = getAccessToken();

  // ✅ MUST HAVE THIS
  if (!token) return;

  // ✅ reset socket for fresh token
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("http://localhost:5000", {
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket connect error:", err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = () => socket;