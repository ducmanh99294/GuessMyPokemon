// Home.jsx
import React, { useState, useRef,useEffect } from 'react';
import '../css/Home.css';
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";

function Home() {
    const navigate = useNavigate();
            // ---- State ----
            // Create room
            const [createName, setCreateName] = useState('');
            const [isPrivate, setIsPrivate] = useState(false);
            const [createLoading, setCreateLoading] = useState(false);
            const [createError, setCreateError] = useState('');

            // Join room
            const [joinCode, setJoinCode] = useState('');
            const [joinName, setJoinName] = useState('');
            const [joinLoading, setJoinLoading] = useState(false);
            const [joinError, setJoinError] = useState('');

            // Settings
            const [settingsOpen, setSettingsOpen] = useState(false);
            const settingsRef = useRef(null);

            // ---- Close settings on click outside ----
            useEffect(() => {
                function handleClickOutside(e) {
                    if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                        setSettingsOpen(false);
                    }
                }
                document.addEventListener('mousedown', handleClickOutside);
                return () => document.removeEventListener('mousedown', handleClickOutside);
            }, []);

            // ---- Handlers ----
    const handleCreateRoom = (e) => {
        e.preventDefault();

        const name = createName.trim();

        if (!name) {
            setCreateError("Vui lòng nhập tên của bạn.");
            return;
        }

        setCreateError("");
        setCreateLoading(true);

        const playerId = getPlayerId();

        const createRoom = () => {
            socket.emit(
                "create_room",
                {
                    playerId,
                    name,
                    mode: isPrivate ? "private" : "pvp",
                },
                (response) => {
                    setCreateLoading(false);

                    if (!response?.success) {
                        setCreateError(
                            response?.message ||
                            "Không thể tạo phòng. Vui lòng thử lại."
                        );
                        return;
                    }

                    console.log(
                        "✅ Tạo phòng thành công:",
                        response
                    );

                    const room = response.room;
                    localStorage.setItem("pokemon_room_id", room.roomId);
                    // Chuyển sang Lobby
                    navigate(`/lobby/${room.roomId}`);
                }
            );
        };

        // Socket đã kết nối
        if (socket.connected) {
            createRoom();
            return;
        }

        // Socket chưa kết nối → chờ kết nối
        socket.once("connect", createRoom);
        socket.connect();
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();

        const code = joinCode.trim().toUpperCase();
        const name = joinName.trim();

        if (!code) {
            setJoinError("Vui lòng nhập mã phòng.");
            return;
        }

        if (!name) {
            setJoinError("Vui lòng nhập tên của bạn.");
            return;
        }

        setJoinError("");
        setJoinLoading(true);

        const playerId = getPlayerId();

        const joinRoom = () => {
            socket.emit(
                "join_room",
                {
                    roomId: code,
                    playerId,
                    name,
                },
                (response) => {
                    setJoinLoading(false);

                    if (!response?.success) {
                        setJoinError(
                            response?.message ||
                            "Không thể tham gia phòng. Kiểm tra mã phòng và thử lại."
                        );
                        return;
                    }

                    console.log("✅ Tham gia phòng thành công:", response);
                    localStorage.setItem("pokemon_room_id", code);
                    navigate(`/lobby/${code}`);
                }
            );
        };

        // Socket đã kết nối
        if (socket.connected) {
            joinRoom();
            return;
        }

        // Socket chưa kết nối → đợi connect
        socket.once("connect", joinRoom);

        socket.connect();
    };

            // ---- Render ----
            return (
                <>
                    <div className="bg-layer" aria-hidden="true">
                        <div className="radial-glow"></div>
                        <div className="radial-glow-2"></div>
                        <div className="particle"></div>
                        <div className="particle"></div>
                        <div className="particle"></div>
                        <div className="particle"></div>
                    </div>

                    <div className="home-container" id="app">

                        <div className="top-bar">
                        <button className="settings-btn" id="settingsBtn" aria-label="Cài đặt">
                            <i className="fas fa-sliders-h"></i>
                            <span>Cài đặt</span>
                        </button>
                        </div>

                        <header className="brand-header">
                        <div className="brand-icon">
                            <div className="pokeball-icon" aria-hidden="true"></div>
                        </div>
                        <h1 className="brand-title">GUSSS MY POKEMON</h1>
                        <p className="brand-sub">
                            <span className="highlight">POKÉMON</span> BÍ MẬT · <span className="highlight">1–4</span> NGƯỜI CHƠI
                        </p>
                        <p className="brand-tagline">Đặt câu hỏi. Suy luận. Đoán đúng.</p>
                        </header>

                        <div className="cards-grid">

                        <div className="action-card create-card" id="createCard">
                            <div className="card-header">
                            <div className="card-icon"><i className="fas fa-plus-circle"></i></div>
                            <div className="card-title-group">
                                <span className="card-title">Tạo phòng</span>
                                <span className="card-subtitle">Bắt đầu một ván chơi mới với bạn bè</span>
                            </div>
                            </div>

                            <form className="card-form" id="createForm" autocomplete="off" onSubmit={handleCreateRoom}>
                            <div className="form-group">
                                <label className="form-label" for="createName">Tên của bạn</label>
                                <input
                                    className="form-input"
                                    id="createName"
                                    type="text"
                                    placeholder="Nhập tên hiển thị..."
                                    maxLength="20"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <div className="toggle-group">
                                <label className="toggle-label" for="privateToggle">Phòng riêng tư</label>
                                <div className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        id="privateToggle"
                                        checked={isPrivate}
                                        onChange={(e) => setIsPrivate(e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn-primary btn-create"
                                id="createBtn"
                                disabled={createLoading}
                            >
                                <span className="btn-text">
                                    {createLoading ? "Đang tạo..." : "Tạo phòng"}
                                </span>

                                {createLoading && (
                                    <span
                                        className="btn-loader"
                                        aria-hidden="true"
                                    ></span>
                                )}
                            </button>
                            </form>
                        </div>

                        <div className="action-card join-card" id="joinCard">
                            <div className="card-header">
                            <div className="card-icon"><i className="fas fa-door-open"></i></div>
                            <div className="card-title-group">
                                <span className="card-title">Tham gia</span>
                                <span className="card-subtitle">Nhập mã phòng để tham gia trận đấu</span>
                            </div>
                            </div>

                            <form className="card-form" id="joinForm" autocomplete="off" onSubmit={handleJoinRoom}>
                            <div className="form-group">
                                <label className="form-label" for="joinRoomCode">Mã phòng</label>
                                <input
                                    className="form-input room-code-input"
                                    id="joinRoomCode"
                                    type="text"
                                    placeholder="VD: A7B3C9"
                                    maxLength="10"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" for="joinName">Tên của bạn</label>
                                <input
                                    className="form-input"
                                    id="joinName"
                                    type="text"
                                    placeholder="Nhập tên hiển thị..."
                                    maxLength="20"
                                    value={joinName}
                                    onChange={(e) => setJoinName(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-primary btn-join"
                                id="joinBtn"
                                disabled={joinLoading}
                            >
                                <span className="btn-text">
                                    {joinLoading ? "Đang vào..." : "Vào phòng"}
                                </span>

                                {joinLoading && (
                                    <span
                                        className="btn-loader"
                                        aria-hidden="true"
                                    ></span>
                                )}
                            </button>
                            </form>
                        </div>

                        </div>

                        <div className="game-flow" aria-label="Các bước chơi">
                        <span className="flow-step">
                            <span className="step-num">01</span>
                            <span className="step-label">Chọn Pokémon</span>
                        </span>
                        <span className="flow-arrow"><i className="fas fa-chevron-right"></i></span>
                        <span className="flow-step">
                            <span className="step-num">02</span>
                            <span className="step-label">Đặt câu hỏi</span>
                        </span>
                        <span className="flow-arrow"><i className="fas fa-chevron-right"></i></span>
                        <span className="flow-step">
                            <span className="step-num">03</span>
                            <span className="step-label">Suy luận</span>
                        </span>
                        <span className="flow-arrow"><i className="fas fa-chevron-right"></i></span>
                        <span className="flow-step">
                            <span className="step-num">04</span>
                            <span className="step-label">Đoán đúng</span>
                        </span>
                        </div>

                    </div>
                </>
            );
        }
        
export default Home;