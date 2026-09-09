import { useEffect, useState } from "react";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import PokemonSelector from "../components/PokemonSelector";
import { useNavigate, useParams } from "react-router-dom";
import '../css/Lobby.css'
function Lobby() {
    const { roomId: urlRoomId } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [error, setError] = useState("");

    const playerId = getPlayerId();

    const roomId =
        urlRoomId ||
        localStorage.getItem("pokemon_room_id");

    useEffect(() => {
        if (!roomId) {
            setError("Không tìm thấy mã phòng.");
            return;
        }

        function reconnectRoom() {
            socket.emit(
                "reconnect_room",
                {
                    roomId,
                    playerId
                },
                (response) => {
                    if (!response?.success) {
                        setError(
                            response?.message ||
                            "Không thể kết nối vào phòng."
                        );
                        return;
                    }

                    console.log(
                        "✅ Reconnected:",
                        response
                    );

                    setRoom(response.room);

                    if (response.gameState) {
                        setGameState(
                            response.gameState
                        );
                    }
                }
            );
        }

        function handleRoomUpdated(updatedRoom) {
            setRoom(updatedRoom);
        }

        function handleGameChoosing(updatedRoom) {
            setRoom(updatedRoom);
        }

        function handlePlayerSelected({ playerId }) {
            setRoom((currentRoom) => {
                if (!currentRoom) return currentRoom;

                return {
                    ...currentRoom,

                    players: currentRoom.players.map(
                        (player) =>
                            player.id === playerId
                                ? {
                                    ...player,
                                    hasSelectedPokemon:
                                        true
                                }
                                : player
                    )
                };
            });
        }

        function handleRoomClosed() {
            localStorage.removeItem(
                "pokemon_room_id"
            );

            setRoom(null);
            setGameState(null);
            setError("Room was closed");
        }

        socket.on(
            "room_updated",
            handleRoomUpdated
        );

        socket.on(
            "game_choosing",
            handleGameChoosing
        );

        socket.on(
            "player_pokemon_selected",
            handlePlayerSelected
        );

        socket.on(
            "game_started",
            handleGameStarted
        );

        socket.on(
            "room_closed",
            handleRoomClosed
        );

        // Connect/reconnect
        if (socket.connected) {
            reconnectRoom();
        } else {
            socket.once(
                "connect",
                reconnectRoom
            );

            socket.connect();
        }

        return () => {
            socket.off(
                "room_updated",
                handleRoomUpdated
            );

            socket.off(
                "game_choosing",
                handleGameChoosing
            );

            socket.off(
                "player_pokemon_selected",
                handlePlayerSelected
            );

            socket.off(
                "game_started",
                handleGameStarted
            );

            socket.off(
                "room_closed",
                handleRoomClosed
            );

            socket.off(
                "connect",
                reconnectRoom
            );
        };
    }, [roomId, playerId]);

function startGame() {
    if (!room) return;

    console.log("HOST CHECK");
    console.log("room.hostId:", room.hostId);
    console.log("playerId:", playerId);
    console.log("isHost:", room.hostId === playerId);

    if (room.hostId !== playerId) {
        setError("Only the host can start the game");
        return;
    }

    socket.emit(
        "start_game",
        {
            roomId: room.roomId,
            playerId
        },
        (response) => {
            console.log("start_game response:", response);

            if (!response?.success) {
                setError(response?.message || "Failed to start game");
            }
        }
    );
}

function leaveRoom() {
    if (!room) return;

    const playerId = getPlayerId();

    socket.emit(
        "leave_room",
        {
            roomId: room.roomId,
            playerId
        },
        (response) => {
            if (!response?.success) {
                console.error("Leave room failed:", response?.message);
                return;
            }

            console.log("Left room");

            localStorage.removeItem("pokemon_room_id");

            setRoom(null);
            setGameState(null);

            navigate("/");
        }
    );
}

    function handleGameStarted(privateGameState) {
        console.log(
            "🎮 Game started:",
            privateGameState
        );

        setGameState(privateGameState);

        console.log(
            "➡️ Navigate to:",
            `/game/${roomId}`
        );

        navigate(`/game/${roomId}`);
    }

    /*
    |--------------------------------------------------------------------------
    | Choosing Pokémon
    |--------------------------------------------------------------------------
    */

    if (
        room &&
        room.status === "choosing"
    ) {
        return (
            <PokemonSelector
                room={room}
                onGameStarted={
                    handleGameStarted
                }
            />
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Lobby
    |--------------------------------------------------------------------------
    */

    if (!room) {
        return (
            <main>
                <h1>Pokémon Guess</h1>

                {error ? (
                    <p>{error}</p>
                ) : (
                    <p>Đang kết nối vào phòng...</p>
                )}
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Waiting Room
    |--------------------------------------------------------------------------
    */

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

        <div className="lobby-container" id="lobbyApp">

            <header className="top-bar">
            <div className="brand">
                <span className="pokeball-mini"></span>
                POKÉDEDUCTION
            </div>

            <div className="room-code-wrapper">
                <span className="room-code-label">Phòng</span>
                <span className="room-code-display" id="roomCodeDisplay">{room.roomId}</span>
                <button className="copy-btn" id="copyRoomBtn" onClick={() => {navigator.clipboard.writeText(room.roomId)}}>
                <i className="fas fa-copy"></i> <span id="copyText">Sao chép</span>
                </button>
            </div>

            <button
                className="leave-btn"
                id="leaveRoomBtn"
                onClick={leaveRoom}
            >
                <i className="fas fa-sign-out-alt"></i>
                Rời phòng
            </button>
            </header>

            <div className="lobby-grid">

            <aside className="sidebar">
                <div className="info-card">
                <div className="card-title">Thông tin phòng</div>
                <div className="info-row">
                    <span className="info-label">Mã phòng</span>
                    <span className="info-value highlight" id="roomCodeInfo">{room.roomId}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Người chơi</span>
                    <span className="info-value" id="playerCountInfo">{room.players.length} / 4</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Chủ phòng</span>
                    <span className="info-value" id="hostNameInfo">
                        {
                            room.players.find(
                                (player) => player.id === room.hostId
                            )?.name || "—"
                        }
                    </span>
                </div>
                <div className="info-row">
                    <span className="info-label">Trạng thái</span>
                    <span className="info-value">
                    <span className="status-badge waiting" id="roomStatusBadge">● Đang chờ</span>
                    </span>
                </div>
                </div>

                <div className="info-card">
                <div className="card-title">Cách chơi</div>
                <div className="rules-list">
                    <div className="rule-item">
                    <span className="rule-num">01</span>
                    <span className="rule-text">Chọn Pokémon bí mật</span>
                    </div>
                    <div className="rule-item">
                    <span className="rule-num">02</span>
                    <span className="rule-text">Đặt câu hỏi</span>
                    </div>
                    <div className="rule-item">
                    <span className="rule-num">03</span>
                    <span className="rule-text">Loại Pokémon bằng suy luận</span>
                    </div>
                    <div className="rule-item">
                    <span className="rule-num">04</span>
                    <span className="rule-text">Đoán đúng để ghi điểm</span>
                    </div>
                </div>
                </div>
            </aside>

            <main className="main-panel">

                <div className="room-header">
                <div className="title-group">
                    <h2>PHÒNG CHỜ</h2>
                    <div className="sub" id="roomSubtitle">Chờ người chơi tham gia...</div>
                </div>
                <div className="room-status">
                    <span className="status-dot waiting" id="statusDot"></span>
                    <span className="status-text" id="statusText">Đang chờ</span>
                </div>
                </div>

                <section className="players-section">
                <div className="section-header">
                    <h3>Người chơi</h3>
                    <span className="player-count" id="playerCountLabel">{room.players.length} / 4</span>
                </div>

                <div className="player-grid" id="playerGrid">
                    {room.players.map((player) => (
                        <div
                            className={`player-card ${
                                player.connected === false
                                    ? "offline"
                                    : ""
                            }`}
                            key={player.id}
                        >
                            <div className="player-avatar">
                                {player.name
                                    ?.charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="player-info">
                                <div className="player-name">
                                    {player.name}

                                    {player.id === room.hostId && (
                                        <span className="host-badge">
                                            HOST
                                        </span>
                                    )}
                                </div>

                                <div className="player-status">
                                    {player.connected === false
                                        ? "Offline"
                                        : player.hasSelectedPokemon
                                        ? "Đã chọn Pokémon"
                                        : "Đang chờ chọn"}
                                </div>
                            </div>

                            <div
                                className={`status-indicator ${
                                    player.connected === false
                                        ? "offline"
                                        : player.hasSelectedPokemon
                                        ? "ready"
                                        : "waiting"
                                }`}
                            />
                        </div>
                    ))}
                </div>
                </section>

                <div className="host-controls" id="hostControls">
                    {room.hostId === playerId && (
                        <button
                            className="start-game-btn"
                            onClick={startGame}
                            disabled={room.players.length < 1}
                        >
                            <i className="fas fa-play"></i>
                            Bắt đầu trận đấu
                        </button>
                    )}

                    {room.hostId !== playerId && (
                        <div className="waiting-message">
                            <i className="fas fa-hourglass-half"></i>
                            Đang chờ chủ phòng bắt đầu...
                        </div>
                    )}
                </div>

            </main>
            </div>
        </div>
        </>
    );
}

export default Lobby;