import { io } from "socket.io-client";
const API_URL = import.meta.env.VITE_API_URL;

const socket = io(API_URL, {
    autoConnect: true
});

export default socket;