// PVP.jsx - Đấu nhanh: bắt cặp ngẫu nhiên với người chơi khác.
// Luồng: bấm "Tìm đối thủ" -> server ghép cặp -> nhận "pvp_matched"
// -> chuyển tới /game/:roomId (dùng lại GameRoom + mọi component sẵn có).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { useAuth } from "../context/AuthContext";
import "../css/PVP.css";

function formatElapsed(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PVP() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [name, setName] = useState(
        () => localStorage.getItem("pokemon_pvp_name") || ""
    );
    const [searching, setSearching] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [matchedName, setMatchedName] = useState("");
    const [error, setError] = useState("");

    const playerId = getPlayerId();
    const timerRef = useRef(null);
    const searchingRef = useRef(false);

    // Nhận phòng sau khi server bắt cặp
    useEffect(() => {
        function onMatched({ roomId, opponent }) {
            setSearching(false);
            searchingRef.current = false;
            setMatchedName(opponent?.name || "Đối thủ");

            localStorage.setItem("pokemon_room_id", roomId);

            // Chờ 1 nhịp để user thấy "Đã tìm thấy đối thủ"
            setTimeout(() => navigate(`/game/${roomId}`), 900);
        }

        socket.on("pvp_matched", onMatched);
        return () => socket.off("pvp_matched", onMatched);
    }, [navigate]);

    // Đồng hồ đếm thời gian chờ
    useEffect(() => {
        if (searching) {
            setElapsed(0);
            timerRef.current = setInterval(
                () => setElapsed((e) => e + 1),
                1000
            );
        } else {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [searching]);

    // Rời trang khi đang tìm -> tự hủy khỏi hàng chờ
    useEffect(() => {
        return () => {
            if (searchingRef.current) {
                socket.emit("pvp_cancel_match", { playerId });
            }
        };
    }, [playerId]);

    function ensureConnected(fn) {
        if (socket.connected) {
            fn();
        } else {
            socket.once("connect", fn);
            socket.connect();
        }
    }

    function handleFind() {
        setError("");

        const playerName = (user?.name || name).trim() || "Player";
        if (!user) {
            localStorage.setItem("pokemon_pvp_name", playerName);
        }

        ensureConnected(() => {
            socket.emit(
                "pvp_find_match",
                { playerId, playerName },
                (res) => {
                    if (!res?.success) {
                        setError(
                            res?.message || "Không thể tìm trận. Thử lại nhé."
                        );
                        return;
                    }

                    searchingRef.current = true;
                    setSearching(true);
                }
            );
        });
    }

    function handleCancel() {
        socket.emit("pvp_cancel_match", { playerId });
        searchingRef.current = false;
        setSearching(false);
    }

    return (
        <div className="pvp-container">
            <div className="pvp-card">
                <div className="pvp-icon">⚔️</div>
                <h1 className="pvp-title">Đấu nhanh PVP</h1>
                <p className="pvp-sub">
                    Bắt cặp ngẫu nhiên với một người chơi khác.
                    Mỗi người chọn một Pokémon bí mật — ai đoán đúng trước thì thắng.
                </p>

                {error && <div className="pvp-error">{error}</div>}

                {!searching && !matchedName && (
                    <>
                        {!user && (
                            <input
                                className="pvp-input"
                                type="text"
                                placeholder="Tên hiển thị của bạn..."
                                maxLength={20}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        )}

                        <button
                            className="pvp-btn pvp-btn-find"
                            onClick={handleFind}
                        >
                            🔍 Tìm đối thủ
                        </button>

                        <button
                            className="pvp-btn pvp-btn-ghost"
                            onClick={() => navigate("/")}
                        >
                            ← Về trang chủ
                        </button>
                    </>
                )}

                {searching && !matchedName && (
                    <div className="pvp-searching">
                        <div className="pvp-spinner" aria-hidden="true" />
                        <div className="pvp-timer">
                            {formatElapsed(elapsed)}
                        </div>
                        <p className="pvp-sub">
                            Đang tìm đối thủ xứng tầm...
                        </p>
                        <button
                            className="pvp-btn pvp-btn-cancel"
                            onClick={handleCancel}
                        >
                            Hủy tìm trận
                        </button>
                    </div>
                )}

                {matchedName && (
                    <div className="pvp-matched">
                        <div className="pvp-check">✅</div>
                        <p className="pvp-sub">
                            Đã tìm thấy <strong>{matchedName}</strong>!
                            Đang vào trận...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PVP;
