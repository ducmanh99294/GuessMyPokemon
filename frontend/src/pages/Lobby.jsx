import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import PokemonSelector from "../components/PokemonSelector";
import { useNavigate, useParams } from "react-router-dom";
import '../css/Lobby.css'
import { useEntrance } from "../hooks/useEntrance";
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

    // Entrance animation (re-runs when switching screens)
    const entranceRef = useRef(null);
    const screen = !room ? "loading" : room.status === "choosing" ? "choosing" : "lobby";
    useEntrance(entranceRef, [screen]);

    useEffect(() => {
        if (!roomId) {
            setError("Room code not found.");
            return;
        }

        function reconnectRoom() {
            socket.emit(
                "reconnect_room",
                {
                    roomId,
                    playerId,
                    authToken: localStorage.getItem("pokemon_auth_token"),
                },
                (response) => {
                    if (!response?.success) {
                        setError(
                            response?.message ||
                            "Could not connect to the room."
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
        <main className="room-loading-page">
            <div className="room-loading-card">

                <div className="loading-pokeball">
                    <div className="pokeball-line"></div>
                    <div className="pokeball-center"></div>
                </div>

                <h1>Pokémon Guess</h1>

                {error ? (
                    <>
                        <p className="room-loading-error">
                            {error}
                        </p>

                        <button
                            className="room-retry-btn"
                            onClick={() => window.location.reload()}
                        >
                            Try Again
                        </button>
                    </>
                ) : (
                    <>
                        <p className="room-loading-text">
                            Connecting to the room...
                        </p>

                        <div className="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </>
                )}

            </div>
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

        <div className="lobby-container" id="lobbyApp" ref={entranceRef}>

            <header className="lobby-top-bar" data-entrance>
            <div className="brand">
                <span className="pokeball-mini"></span>
                POKÉDEDUCTION
            </div>

            <div className="room-code-wrapper">
                <span className="room-code-label">Room</span>
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
                Leave Room
            </button>
            </header>

            <div className="lobby-grid">

            <aside className="sidebar" data-entrance>
                <div className="info-card">
                <div className="card-title">Room Info</div>
                <div className="info-row">
                    <span className="info-label">Room Code</span>
                    <span className="info-value highlight" id="roomCodeInfo">{room.roomId}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Players</span>
                    <span className="info-value" id="playerCountInfo">{room.players.length} / 4</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Host</span>
                    <span className="info-value" id="hostNameInfo">
                        {
                            room.players.find(
                                (player) => player.id === room.hostId
                            )?.name || "—"
                        }
                    </span>
                </div>
                <div className="info-row">
                    <span className="info-label">Status</span>
                    <span className="info-value">
                    <span className="status-badge waiting" id="roomStatusBadge">● Waiting</span>
                    </span>
                </div>
                </div>

                <div className="info-card">
                <div className="card-title">How to Play</div>
                <div className="rules-list">
                    <div className="rule-item">
                    <span className="rule-num">01</span>
                    <span className="rule-text">Pick a secret Pokémon</span>
                    </div>
                    <div className="rule-item">
                    <span className="rule-num">02</span>
                    <span className="rule-text">Ask questions</span>
                    </div>
                    <div className="rule-item">
                    <span className="rule-num">03</span>
                    <span className="rule-text">Eliminate Pokémon by deduction</span>
                    </div>
                    <div className="rule-item">
                    <span className="rule-num">04</span>
                    <span className="rule-text">Guess right to score</span>
                    </div>
                </div>
                </div>
            </aside>

            <main className="main-panel" data-entrance>

                <div className="room-header">
                <div className="title-group">
                    <h2>LOBBY</h2>
                    <div className="sub" id="roomSubtitle">Waiting for players to join...</div>
                </div>
                <div className="room-status">
                    <span className="status-dot waiting" id="statusDot"></span>
                    <span className="status-text" id="statusText">Waiting</span>
                </div>
                </div>

                <section className="players-section">
                <div className="section-header">
                    <h3>Players</h3>
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
                                        ? "Pokémon picked"
                                        : "Waiting to pick"}
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
                            Start Match
                        </button>
                    )}

                    {room.hostId !== playerId && (
                        <div className="waiting-message">
                            <i className="fas fa-hourglass-half"></i>
                            Waiting for the host to start...
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