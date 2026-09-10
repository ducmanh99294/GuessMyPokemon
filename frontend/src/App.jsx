import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import GameRoom from "./pages/GameRoom";

// @ts-expect-error The socket module is currently implemented in JavaScript.
import socket from "./socket/socket";

function App() {
    useEffect(() => {
        function handleConnect() {
            console.log("Connected:", socket.id);
        }

        function handleDisconnect(reason) {
            console.log("Disconnected:", reason);
        }

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        if (socket.connected) {
            console.log("Connected:", socket.id);
        }

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
        };
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                {/* Trang chủ */}
                <Route path="/" element={<Home />} />

                {/* Phòng chờ */}
                <Route path="/lobby/:roomId" element={<Lobby />} />

                {/* Phòng chơi */}
                <Route path="/game/:roomId" element={<GameRoom />} />

                {/* Không tìm thấy trang */}
                <Route
                    path="*"
                    element={<Home />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;