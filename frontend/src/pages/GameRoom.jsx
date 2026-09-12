import ChatPanel from "../components/ChatPanel";
import { useEffect, useState } from "react";
import FilterPanel from "../components/FilterPanel";
import PokemonList from "../components/PokemonList";
import GameResult from "../components/GameResult";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { useNavigate, useParams } from "react-router-dom";
import "../css/GameRoom.css";
    const DEFAULT_FILTERS = {
        type: [],
        name: "",
        generation: null,
        legendary: null,
        mythical: null,
        mega: null,
        hasEvolution: null,
        evolutionForms: null,
        effective: [],
        noEffect: [],
        notEffect: [],
        superEffect: []
    };

function GameRoom() {
    const [filtersOpen, setFiltersOpen] = useState(true); // ⭐ thêm state
    const { roomId } = useParams();
    const [notes, setNotes] = useState("");
    const [guessMessage, setGuessMessage] = useState("");
    const navigate = useNavigate();
    const [guessMessageType, setGuessMessageType] = useState("");
    const [pendingGuess, setPendingGuess] = useState(null);
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [gameState, setGameState] = useState(null);
    const [cooldownUntil, setCooldownUntil] = useState(0);
    const [cooldownLeft, setCooldownLeft] = useState(0);
    const [guessing, setGuessing] = useState(false);
    const [guessResult, setGuessResult] = useState(null);
    const [gameFinished, setGameFinished] = useState(null);

    const myPlayerId = getPlayerId();
    const opponents = (gameState?.players || []).filter(
        (p) => p.id !== myPlayerId && !p.finished
    );

const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const targetPlayer = gameState?.players?.find(
        (player) =>
            player.id === gameState.targetPlayerId
    );

function doGuess(pokemon, targetPlayerId) {
    setGuessing(true);
    setGuessResult(null);

    socket.emit(
        "guess_pokemon",
        { roomId: gameState.roomId, pokemonId: pokemon.id, targetPlayerId },
        (response) => {
            setGuessing(false);

            if (!response?.success) {
                setGuessResult({ correct: false, error: response?.message });
                return;
            }

            const result = response.result;
            setGuessResult(result);
            setCooldownUntil(Date.now() + 3000);

            // ⭐ XOÁ toàn bộ đoạn setGameState(wrongGuesses) và setGuessMessage(autoRevealed) ở đây
            // Lý do: handlePlayerGuessResult (broadcast) đã lo việc này cho TẤT CẢ mọi người,
            // bao gồm cả chính người đoán — không cần set trùng lặp ở callback riêng nữa.
        }
    );
}

    function confirmTargetSelection(targetPlayerId,) {
        if (!pendingGuess) return;
        setShowTargetModal(false);
        doGuess(pendingGuess, targetPlayerId);
        setPendingGuess(null);
    }

    function leaveRoom() {
        const confirmed = window.confirm("Bạn có chắc muốn rời phòng?");
        if (!confirmed) return;

        socket.emit(
            "leave_room",
            {
                roomId: gameState?.roomId || roomId,
                playerId: myPlayerId
            },
            (response) => {
                if (!response?.success) {
                    console.error("Leave room failed:", response?.message);
                    return;
                }

                localStorage.removeItem("pokemon_room_id");
                localStorage.removeItem("pokemon_guess_room");

                navigate("/");
            }
        );
    }

    function handleContinue() {
        // Rematch đã được gọi bên trong GameResult (socket.emit "rematch")
        // Sau khi thành công, điều hướng sang Lobby để chọn Pokémon mới
        navigate(`/lobby/${roomId}`);
    }

    function handleLeaveResult() {
        socket.emit(
            "leave_room",
            { roomId, playerId: myPlayerId },
            (response) => {
                if (response?.success) {
                    localStorage.removeItem("pokemon_room_id");
                    localStorage.removeItem("pokemon_guess_room");
                    navigate("/");
                }
            }
        );
    }
    
    useEffect(() => {
        function handleGameChoosing() {
            navigate(`/lobby/${roomId}`);
        }

        socket.on("game_choosing", handleGameChoosing);

        return () => {
            socket.off("game_choosing", handleGameChoosing);
        };
    }, [roomId, navigate]);

    useEffect(() => {
        if (!cooldownUntil) return;
        const interval = setInterval(() => {
            const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setCooldownLeft(left);
            if (left <= 0) clearInterval(interval);
        }, 250);
        return () => clearInterval(interval);
    }, [cooldownUntil]);

    useEffect(() => {
        if (!roomId) return;
        const saved = localStorage.getItem(`pokemon_notes_${roomId}`);
        if (saved) setNotes(saved);
    }, [roomId]);

    function handleNotesChange(e) {
        const value = e.target.value;
        setNotes(value);
        localStorage.setItem(`pokemon_notes_${roomId}`, value);
    }
    function handleGuess(pokemon) {
        if (
            guessing ||
            cooldownLeft > 0
        ) {PokemonList
            return;
        }

        // Danh sách đối thủ chưa đoán đúng
        const availableOpponents = (gameState?.players || []).filter(
            (p) => p.id !== myPlayerId && !p.finished
        );

        // Không có đối thủ
        if (availableOpponents.length === 0) {
            return;
        }

        // Có nhiều hơn 1 đối thủ
        // => mở modal cho người chơi chọn target
        if (availableOpponents.length > 1) {
            setPendingGuess(pokemon);
            setShowTargetModal(true);
            return;
        }

        // Chỉ có 1 đối thủ
        // => xác nhận rồi đoán thẳng
        const target = availableOpponents[0];

        const confirmed = window.confirm(
            `Guess ${pokemon.name} của ${target.name}?`
        );

        if (!confirmed) return;

        doGuess(pokemon, target.id);
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

useEffect(() => {
    function handlePlayerGuessResult({
        playerId,
        guesserName,
        guessedPokemon,
        targetPlayerId,
        correct,
        revealedPlayerId,
        autoRevealed,
        totalScore,
        revealedPokemon,
        wrongGuesses
    }) {

        console.log("[RAW EVENT] player_guess_result:", {
            playerId, targetPlayerId, correct, revealedPlayerId,
            autoRevealed, totalScore, revealedPokemon, wrongGuesses
        });

        // ⭐ XOÁ dòng "if (!correct && !autoRevealed) return;" — đây là nguyên nhân chặn mọi thứ

        // Cập nhật state — luôn chạy, kể cả khi đoán sai bình thường (để đồng bộ wrongGuesses)
        setGameState((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                wrongGuesses: wrongGuesses || prev.wrongGuesses,
                players: prev.players.map((p) => {
                    if (p.id === playerId && correct) {
                        return { ...p, score: totalScore };
                    }
                    if (p.id === revealedPlayerId) {
                        return { ...p, finished: true, revealedPokemon };
                    }
                    return p;
                })
            };
        });

        // ⭐ Trường hợp 1: đoán sai bình thường (chưa đủ 5 lần)
        if (!correct && !autoRevealed) {
            const isMe = playerId === myPlayerId;
            const msg = isMe
                ? `❌ Bạn đã đoán sai ${guessedPokemon?.name}!`
                : `❌ ${guesserName || "Người chơi"} đã đoán sai ${guessedPokemon?.name}!`;

            console.log("[SETTING MESSAGE]", msg);
            setGuessMessage(msg);
            setGuessMessageType("error");

            setTimeout(() => {
                setGuessMessage("");
                setGuessMessageType("");
            }, 2000);

            return; // dừng ở đây, không chạy tiếp xuống autoRevealed bên dưới
        }

        // ⭐ Trường hợp 2: tự động lộ do đủ 5 lần sai
        if (autoRevealed) {
            const isMe = revealedPlayerId === myPlayerId;
            setGuessMessage(
                isMe
                    ? `⚠️ Bạn đã đoán sai 5 lần! Pokémon của bạn (${revealedPokemon?.name}) đã bị lộ.`
                    : `⚠️ ${revealedPokemon?.name || "???"} của một người chơi đã tự động bị lộ do đoán sai quá nhiều!`
            );
            setGuessMessageType("error");

            setTimeout(() => {
                setGuessMessage("");
                setGuessMessageType("");
            }, 3000);
        }

        // Trường hợp correct=true không cần banner riêng ở đây nếu bạn đã có modal "Đoán đúng!" xử lý qua guessResult
    }

    socket.on("player_guess_result", handlePlayerGuessResult);

    return () => {
        socket.off("player_guess_result", handlePlayerGuessResult);
    };
}, [myPlayerId]);

function EffectivenessPanel({ effectiveness }) {
    if (!effectiveness) return null;

    const groups = { super_effective: [], effective: [], not_effective: [], no_effect: [] };

    Object.entries(effectiveness).forEach(([type, data]) => {
        groups[data.category]?.push(type);
    });

    const sections = [
        { key: "super_effective", label: "super_effective (x2+) (x1/2 when attack type...)", className: "weak" },
        { key: "not_effective", label: "not effective (x1/2) (x2 when attack type...)", className: "resist" },
        { key: "no_effect", label: "no effect (x0)", className: "immune" },
        { key: "effective", label: "normal (x1)", className: "normal" }
    ];

    return (
        <div className="effectiveness-panel">
            {sections.map(({ key, label, className }) =>
                groups[key].length > 0 ? (
                    <div key={key} className={`eff-row ${className}`}>
                        <span className="eff-label">{label}</span>
                        <div className="eff-types">
                            {groups[key].map((type) => (
                                <span key={type} className={`type type-${type}`}>
                                    {type}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null
            )}
        </div>
    );
}
console.log(guessMessage)
if (!gameState) {
    return (
        <main className="room-loading-page">
            <div className="room-loading-card">

                <div className="loading-pokeball">
                    <div className="pokeball-line"></div>
                    <div className="pokeball-center"></div>
                </div>

                <h1>Pokémon Guess</h1>

                <p className="room-loading-text">
                    Đang tải game...
                </p>

                <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>

            </div>
        </main>
    );
}
    if (gameFinished) {
        return (
            <GameResult
                result={gameFinished}
                roomId={roomId}
                onRematch={handleContinue} 
                onLeave={handleLeaveResult} 
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
                        onClick={leaveRoom}
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
                            : "online"
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
                        {player.revealedPokemon?.sprite && (
                            <div className="revealed-mini">
                                <img
                                    src={player.revealedPokemon.sprite}
                                    alt={player.revealedPokemon.name}
                                    title={player.revealedPokemon.name}
                                />
                            </div>
                        )}  

                    </div>

                </div>

            ))}

        </div>


    <div className="panel-title" style={{ marginTop: "16px" }}>
            Pokémon của bạn
    </div>
    {gameState.myPokemon ? (
        <div className="my-pokemon-card">
            {gameState.myPokemon.sprite && (
                <img
                    src={gameState.myPokemon.sprite}
                    alt={gameState.myPokemon.name}
                    width="72"
                    height="72"
                />
            )}

            <div className="my-pokemon-name">
                {gameState.myPokemon.name}
            </div>
                                    
            <div className="my-pokemon-types">
                {gameState.myPokemon.types?.map((type) => (
                    <span key={type} className={`type type-${type}`}>
                        {type}
                    </span>
                ))}
            </div>

            <div className="my-pokemon-tags">
                <span className="tag">Gen {gameState.myPokemon.generation}</span>
                {gameState.myPokemon.legendary ? <span className="tag legendary">Legendary</span> : <span className="tag legendary">Not Legendary</span>}
                {gameState.myPokemon.mythical ? <span className="tag mythical">Mythical</span> : <span className="tag mythical">Not Mythical</span>}
                {gameState.myPokemon.baby && <span className="tag">Baby</span>}
                <span className="tag">
                    {gameState.myPokemon.hasEvolution
                        ? `has evolution`
                        : "No evolution"}
                        
                </span>
                <span className="tag">
                    {gameState.myPokemon.hasEvolution
                        ? `${gameState.myPokemon.evolutionForms} forms`
                        : ""}
                        
                </span>
            </div>
            The effectiveness of each type on {gameState.myPokemon.name}
            <EffectivenessPanel effectiveness={gameState.myPokemon.effectiveness} />
        </div>
    ) : (
        <p className="player-status">Chưa có dữ liệu Pokémon.</p>
    )}

    <div className="panel-title" style={{ marginTop: "16px" }}>
        Ghi chú
    </div>
    <textarea
        className="notes-textarea"
        value={notes}
        onChange={handleNotesChange}
        placeholder="Ghi chú..."
        rows={5}
    />    
</div>

    {/* =================================================
        CENTER - POKEDEX
    ================================================== */}
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
            disabled={cooldownLeft > 0}
            // eliminatedIds={gameState.wrongGuesses || []}
            wrongGuesses={new Set(gameState.wrongGuesses || [])}
        />

    </div>


    {/* =================================================
        RIGHT - CHAT (⭐ khối riêng, ngang hàng với players/pokedex/filter)
    ================================================== */}
    <div className="panel chat-section">

        <div className="panel-title">
            Chat
        </div>

        <ChatPanel
            roomId={gameState.roomId}
        />
    <div className="filter-bar">

        <div
            className="filter-bar-header"
            onClick={() => setFiltersOpen((prev) => !prev)}
        >

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

        {filtersOpen && (
            <FilterPanel
                filters={filters}
                updateFilter={updateFilter}
                removeFilter={removeFilter}
            />
        )}

    </div>
    </div>


    {/* =================================================
        FILTER
    ================================================== */}


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

{showTargetModal && (
    <div className="modal-overlay open">
        <div className="modal">
            <h2>Chọn người chơi để đoán</h2>
            <p>Bạn muốn đoán Pokémon bí mật của ai?</p>

            <div className="options">
                {opponents.map((p) => (
                    <button
                        key={p.id}
                        className="opt"
                        onClick={() => confirmTargetSelection(p.id)}
                    >
                        {p.name}
                    </button>
                ))}
            </div>

            <div className="actions">
                <button
                    className="btn btn-secondary"
                    onClick={() => {
                        setShowTargetModal(false);
                        setPendingGuess(null);
                    }}
                >
                    Hủy
                </button>
            </div>
        </div>
    </div>
)}

{guessMessage && (
    <div className={`guess-message ${guessMessageType}`}>
        {guessMessage}
    </div>
)}

{guessResult?.correct && (
    <div className="modal-overlay open">
        <div className="modal">
            <h2>Đoán đúng!</h2>
            <p>Bảng điểm phòng {gameState.roomId}</p>

            <div className="leaderboard">
                {[...gameState.players]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((p, i) => (
                        <div className="row" key={p.id}>
                            <span className="pos">#{i + 1}</span>
                            <span className="pname">{p.name}</span>
                            <span className="pscore">{p.score || 0}</span>
                        </div>
                    ))}
            </div>

            <div className="actions">
                <button className="btn btn-secondary" onClick={leaveRoom}>
                    Rời phòng
                </button>
                <button className="btn btn-primary" onClick={() => setGuessResult(null)}>
                    Tiếp tục
                </button>
            </div>
        </div>
    </div>
)}

{/* {guessResult && !guessResult.correct && (
    <div className="modal-overlay open">
        <div className="modal">
            <h2 style={{ color: "#ff6b6b" }}>
                {guessResult.error ? "Không thể đoán" : guessResult.autoRevealed
                    ? "Pokémon của bạn đã bị lộ!"
                    : "Sai rồi!"}
            </h2>
            <p>
                {guessResult.error
                    ? guessResult.error
                    : guessResult.autoRevealed
                    ? `Bạn đã đoán sai ${guessResult.maxWrongGuesses} lần liên tiếp, nên ${guessResult.targetPokemon?.name} đã tự động bị lộ.`
                    : `${guessResult.guessedPokemon?.name} không phải Pokémon của .`}

            </p>
            <div className="actions">
                <button
                    className="btn btn-primary"
                    onClick={() => setGuessResult(null)}
                >
                    Đã hiểu
                </button>
            </div>
        </div>
    </div>
)} */}
    </>
);
}

export default GameRoom;