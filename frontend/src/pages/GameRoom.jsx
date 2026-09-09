import ChatPanel from "../components/ChatPanel";
import { useEffect, useState } from "react";
import FilterPanel from "../components/FilterPanel";
import PokemonList from "../components/PokemonList";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { useParams } from "react-router-dom";
import "../css/GameRoom.css";
    const DEFAULT_FILTERS = {
        type: [],
        generation: null,
        legendary: null,
        mythical: null,
        hasEvolution: null,
        evolutionForms: null,
        effective: [],
        noEffect: [],
        notEffect: [],
        superEffect: []
    };

function GameRoom() {
    const { roomId } = useParams();

    const [gameState, setGameState] = useState(null);

    const [activeTab, setActiveTab] = useState("clues");
    const [guessing, setGuessing] = useState(false);
    const [guessResult, setGuessResult] = useState(null);
    const [gameFinished, setGameFinished] = useState(null);


const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const targetPlayer = gameState?.players?.find(
        (player) =>
            player.id === gameState.targetPlayerId
    );

    function handleGuess(pokemon) {
        if (guessing || gameState.finished) {
            return;
        }

        const confirmed =
            window.confirm(
                `Guess ${pokemon.name}?`
            );

        if (!confirmed) {
            return;
        }

        setGuessing(true);
        setGuessResult(null);

        socket.emit(
            "guess_pokemon",
            {
                roomId: gameState.roomId,
                pokemonId: pokemon.id
            },
            (response) => {
                setGuessing(false);

                if (!response?.success) {
                    setGuessResult({
                        correct: false,
                        error: response?.message
                    });

                    return;
                }

                setGuessResult(
                    response.result
                );
            }
        );
    }

    useEffect(() => {
        function handleGameFinished(result) {
            setGameFinished(result);
        }

        socket.on(
            "game_finished",
            handleGameFinished
        );

        return () => {
            socket.off(
                "game_finished",
                handleGameFinished
            );
        };
    }, []);

    useEffect(() => {
        function handleConnect() {
            const playerId = getPlayerId();

            const roomId =
                localStorage.getItem(
                    "pokemon_guess_room"
                );

            if (!roomId) return;

            socket.emit(
                "reconnect_room",
                {
                    roomId,
                    playerId
                },
                (response) => {
                    if (!response?.success) {
                        console.log(
                            "Reconnect failed:",
                            response?.message
                        );
                        return;
                    }

                    console.log(
                        "Reconnected to room"
                    );
                }
            );
        }

        socket.on("connect", handleConnect);

        return () => {
            socket.off("connect", handleConnect);
        };
    }, []);

    useEffect(() => {
        if (!roomId) return;

        const playerId = getPlayerId();

        function reconnectRoom() {
            socket.emit(
                "reconnect_room",
                {
                    roomId,
                    playerId
                },
                (response) => {
                    if (!response?.success) {
                        console.error(
                            "Reconnect failed:",
                            response?.message
                        );
                        return;
                    }

                    console.log(
                        "🎮 GameRoom reconnected:",
                        response
                    );

                    if (response.gameState) {
                        setGameState(response.gameState);

                        setFilters(
                            response.gameState.filters ||
                            DEFAULT_FILTERS
                        );
                    }
                }
            );
        }

        if (socket.connected) {
            reconnectRoom();
        } else {
            socket.once("connect", reconnectRoom);
            socket.connect();
        }

        return () => {
            socket.off("connect", reconnectRoom);
        };
    }, [roomId]);

    function updateFilter(key, value) {
        const updatedFilters = {
            ...filters,
            [key]: value
        };

        setFilters(updatedFilters);

        socket.emit(
            "update_filters",
            {
                roomId,
                filters: updatedFilters
            },
            (response) => {
                if (!response?.success) {
                    console.error(
                        "Filter update failed:",
                        response?.message
                    );
                    return;
                }

                // Nhận danh sách Pokémon sau khi lọc
                if (response.candidates) {
                    setGameState((prev) => ({
                        ...prev,
                        candidates: response.candidates
                    }));
                }
            }
        );
    }

    function removeFilter(key) {
        setFilters((prev) => {
            const updatedFilters = {
                ...prev,
                [key]: Array.isArray(prev[key]) ? [] : null
            };

            socket.emit("update_filters", {
                roomId,
                filters: updatedFilters
            });

            return updatedFilters;
        });
    }

    if (!gameState) {
        return (
            <main>
                <h1>Pokémon Guess</h1>
                <p>Đang tải game...</p>
            </main>
        );
    }
    if (gameFinished) {
        return (
            <GameResult
                result={gameFinished}
            />
        );
    }

return (
    <>
        {/* BACKGROUND */}
        <div className="bg-layer" aria-hidden="true">
            <div className="radial-glow"></div>
            <div className="radial-glow-2"></div>

            <div className="particle"></div>
            <div className="particle"></div>
            <div className="particle"></div>
            <div className="particle"></div>
        </div>

        {/* RECONNECT */}
        <div
            className="reconnect-banner"
            id="reconnectBanner"
        >
            <i className="fas fa-sync-alt fa-spin"></i>
            {" "}Connection lost — reconnecting...
        </div>

        <div
            className="game-container"
            id="gameApp"
        >

            {/* =====================================================
                HEADER
            ====================================================== */}
            <header className="top-bar">

                <div className="brand">
                    <span className="pokeball-mini"></span>
                    GUESS MY POKEMON
                </div>

                <div
                    className="room-code"
                    id="roomCodeDisplay"
                >
                    {gameState.roomId}
                </div>

                <div className="right-actions">

                    <span className="connection-status">
                        <span
                            className="dot"
                            id="connectionDot"
                        ></span>

                        <span id="connectionText">
                            Connected
                        </span>
                    </span>

                    <button
                        className="leave-btn"
                        id="leaveGameBtn"
                    >
                        <i className="fas fa-sign-out-alt"></i>
                        {" "}Rời
                    </button>

                </div>

            </header>


            {/* =====================================================
                FILTER - FULL WIDTH
            ====================================================== */}



            {/* =====================================================
                MAIN GAME
                PLAYERS | POKEDEX | CHAT
            ====================================================== */}
            <div className="game-grid">


                {/* =================================================
                    LEFT - PLAYERS
                ================================================== */}
                <div className="panel players-panel">

                    <div className="panel-title">
                        Người chơi
                    </div>

                    <div className="player-list">

                        {gameState.players?.map((player) => (

                            <div
                                key={player.id}
                                className={`player-card ${
                                    player.connected === false
                                        ? "offline"
                                        : ""
                                }`}
                            >

                                <div className="player-avatar">
                                    {player.name
                                        ?.charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div className="player-info">

                                    <div className="player-name">

                                        {player.name}

                                        {player.id ===
                                            gameState.targetPlayerId && (
                                            <span className="target-badge">
                                                TARGET
                                            </span>
                                        )}

                                    </div>

                                    <div className="player-status">

                                        {player.finished
                                            ? "Đã đoán đúng"
                                            : player.connected === false
                                            ? "Offline"
                                            : "Đang chơi"}

                                    </div>

                                </div>

                            </div>

                        ))}

                    </div>

                <ChatPanel
                    roomId={gameState.roomId}
                />
                </div>


                {/* =================================================
                    CENTER - POKEDEX
                ================================================== */}
{/* POKEDEX */}
<div className="pokemon-grid-wrapper">

    <div className="grid-header">

        <span className="title">
            <i className="fas fa-list-ul"></i>
            {" "}Pokédex
        </span>

        <span className="count">
            {gameState.candidates?.length || 0}
            {" "}Pokémon
        </span>

    </div>

    <PokemonList
        pokemon={gameState.candidates || []}
        loading={false}
        onGuess={handleGuess}
        guessing={guessing}
        disabled={gameState.finished}
    />

</div>


                {/* =================================================
                    RIGHT - CHAT
                ================================================== */}

            <div className="filter-bar">

                <div className="filter-bar-header">

                    <span>
                        <i className="fas fa-filter"></i>
                        Bộ lọc suy luận
                    </span>

                    <span className="filter-count">
                        {Object.values(filters).filter(
                            (value) =>
                                Array.isArray(value)
                                    ? value.length > 0
                                    : value !== null
                        ).length}{" "}
                        bộ lọc
                    </span>

                </div>

                <FilterPanel
                    filters={filters}
                    updateFilter={updateFilter}
                    removeFilter={removeFilter}
                />

            </div>
            </div>


            {/* =====================================================
                BOTTOM ACTION BAR
            ====================================================== */}
            <div className="action-bar">

                <div className="clue-counter">

                    <i className="fas fa-lightbulb"></i>

                    {" "}Clues used:

                    <span className="num">
                        {gameState.cluesUsed}
                    </span>

                </div>

                <div
                    className="action-buttons"
                    style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        flexWrap: "wrap"
                    }}
                >

                    <button
                        className="ask-clue-btn"
                        id="askClueBtn"
                    >
                        <i className="fas fa-question-circle"></i>
                        {" "}Ask Clue
                    </button>

                    <button
                        className="guess-btn"
                        id="guessBtn"
                        disabled
                    >
                        Guess Pokémon
                    </button>

                </div>

            </div>

        </div>


        {/* =========================================================
            ASK CLUE MODAL
        ========================================================== */}
        <div
            className="modal-overlay"
            id="askClueModal"
        >

            <div className="modal">

                <h2>

                    <i
                        className="fas fa-question-circle"
                        style={{
                            color: "#ffd700"
                        }}
                    ></i>

                    {" "}Ask a Clue

                </h2>

                <p>
                    Chọn loại câu hỏi bạn muốn hỏi.
                </p>

                <div
                    className="options"
                    id="clueOptions"
                >

                    <button
                        className="opt"
                        data-clue="type"
                    >
                        Loại (Type)
                    </button>

                    <button
                        className="opt"
                        data-clue="generation"
                    >
                        Hệ thế hệ (Generation)
                    </button>

                    <button
                        className="opt"
                        data-clue="legendary"
                    >
                        Legendary?
                    </button>

                    <button
                        className="opt"
                        data-clue="mythical"
                    >
                        Mythical?
                    </button>

                    <button
                        className="opt"
                        data-clue="evolution"
                    >
                        Có tiến hóa?
                    </button>

                    <button
                        className="opt"
                        data-clue="effectiveness"
                    >
                        Hiệu quả chiến đấu
                    </button>

                </div>

                <div className="actions">

                    <button
                        className="btn btn-secondary"
                        id="closeClueModal"
                    >
                        Hủy
                    </button>

                </div>

            </div>

        </div>


        {/* =========================================================
            GUESS MODAL
        ========================================================== */}
        <div
            className="modal-overlay guess-modal"
            id="guessModal"
        >

            <div className="modal">

                <h2>
                    Xác nhận đoán
                </h2>

                <p>
                    Bạn chắc chắn Pokémon này là Pokémon bí mật?
                </p>

                <div
                    className="pokemon-preview"
                    id="guessPreview"
                >

                    <div
                        className="sprite"
                        id="guessSprite"
                    >
                        ⚡
                    </div>

                    <div
                        className="name"
                        id="guessName"
                    >
                        Pikachu
                    </div>

                </div>

                <div className="actions">

                    <button
                        className="btn btn-secondary"
                        id="cancelGuess"
                    >
                        Hủy
                    </button>

                    <button
                        className="btn btn-primary"
                        id="confirmGuess"
                    >
                        Đoán!
                    </button>

                </div>

            </div>

        </div>


        {/* =========================================================
            RESULT MODAL
        ========================================================== */}
        <div
            className="result-overlay"
            id="resultOverlay"
        >

            <div className="result-card">

                <h1>
                    🏆 GAME OVER
                </h1>

                <div className="sub">
                    Kết quả cuối cùng
                </div>

                <div
                    className="leaderboard"
                    id="resultLeaderboard"
                >
                </div>

                <div className="actions">

                    <button
                        className="btn btn-primary"
                        id="playAgainBtn"
                    >
                        Play Again
                    </button>

                    <button
                        className="btn btn-secondary"
                        id="backHomeBtn"
                    >
                        Back to Home
                    </button>

                </div>

            </div>

        </div>

    </>
);
}

export default GameRoom;