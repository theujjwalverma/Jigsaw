import { io } from "socket.io-client";
import { API_BASE } from "./api";

export const socket = io(API_BASE || undefined, {
  autoConnect: false,
  transports: ["websocket"],
});
