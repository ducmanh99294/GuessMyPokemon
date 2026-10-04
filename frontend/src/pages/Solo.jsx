// Solo.jsx - Daily Challenge page (one shared secret Pokémon per day)
// Rules: every day brings one secret Pokémon shared by everyone. Ask at most 20 Yes/No questions; the earlier you guess right, the more points.
// Score = max(100, 1000 - questions*45 - wrongGuesses*20)
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { useAuth } from "../context/AuthContext";
import { useEntrance } from "../hooks/useEntrance";
import SoloLeaderboard from "../components/SoloLeaderboard";
import GuestWarningModal from "../components/GuestWarningModal";
import "../css/Solo.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function Solo() {
    const { user, token } = useAuth(); // null for guest play
    const navigate = useNavigate();
    const [showGuestWarning, setShowGuestWarning] = useState(false);
    const guestAcked = useRef(false); // guest acknowledged this session

    const [game, setGame] = useState(null); // public state from server
    const [questions, setQuestions] = useState([]); // { key, label, needsValue }
    const [genValue, setGenValue] = useState("1");
    const [freeQuestion, setFreeQuestion] = useState("");
    const [guessInput, setGuessInput] = useState("");
    const [playerName, setPlayerName] = useState(
        () => localStorage.getItem("pokemon_solo_name") || ""
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastGuess, setLastGuess] = useState(null); // { correct, ... }
    const [lbRefresh, setLbRefresh] = useState(0);
    const [alreadyPlayed, setAlreadyPlayed] = useState(false); // finished today's challenge

    // Logged in -> playerId namespaced by account id (server still
    // verifies the JWT; this is only the socket/game key).
    // Not logged in -> guest play with an anonymous playerId.
    const playerId = user ? `user_${user.id}` : getPlayerId();
    const finished = game && game.status !== "playing";

    // Entrance animation, re-run when switching screens
    const entranceRef = useRef(null);
    const screen = game ? (finished ? "result" : "game") : (alreadyPlayed ? "done" : "start");
    useEntrance(entranceRef, [screen]);

    // Identity changed (guest <-> logged in): clear stale state so the
    // new identity gets a fresh check.
    useEffect(() => {
        setAlreadyPlayed(false);
        setGame(null);
        setError("");
    }, [playerId]);

    // Countdown to midnight (for the "already played" screen)
    const [countdown, setCountdown] = useState("--:--:--");
    useEffect(() => {
        if (!alreadyPlayed) return;
        const tick = () => {
            const now = new Date();
            const end = new Date(now);
            end.setHours(24, 0, 0, 0);
            const s = Math.max(0, Math.floor((end - now) / 1000));
            const hh = String(Math.floor(s / 3600)).padStart(2, "0");
            const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
            const ss = String(s % 60).padStart(2, "0");
            setCountdown(`${hh}:${mm}:${ss}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [alreadyPlayed]);

    // Refresh the leaderboard whenever a game ends
    useEffect(() => {
        if (finished) setLbRefresh((v) => v + 1);
    }, [finished]);

    // Resume an in-progress game if the user refreshes mid-game,
    // and check whether today's challenge is already finished.
    useEffect(() => {
        function fetchState() {
            socket.emit(
                "solo_played_today",
                { playerId, authToken: token || null },
                (res) => {
                    if (res?.success && res.played) {
                        setAlreadyPlayed(true);
                    }
                }
            );
            socket.emit("solo_state", { playerId }, (res) => {
                if (
                    res?.success &&
                    res.state &&
                    res.state.status === "playing"
                ) {
                    setGame(res.state);
                    setQuestions(res.questions || []);
                }
            });
        }

        if (socket.connected) {
            fetchState();
        } else {
            socket.once("connect", fetchState);
            socket.connect();
        }

        return () => {
            socket.off("connect", fetchState);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function ensureConnected(fn) {
        if (socket.connected) {
            fn();
        } else {
            socket.once("connect", fn);
            socket.connect();
        }
    }

    function handleStart() {
        // Not logged in -> warn that scores won't be saved (once per session)
        if (!user && !guestAcked.current) {
            setShowGuestWarning(true);
            return;
        }

        doStart();
    }

    function handleGuestConfirm() {
        guestAcked.current = true;
        setShowGuestWarning(false);
        doStart();
    }

    function doStart() {
        setError("");
        setAlreadyPlayed(false);
        setLastGuess(null);
        setGuessInput("");
        setLoading(true);

        const name = (user?.name || playerName).trim();
        if (!user && name) localStorage.setItem("pokemon_solo_name", name);

        ensureConnected(() => {
            // authToken lets the server verify the login and decide
            // whether this game counts toward the leaderboard.
            // Guests (no token) play for fun: score is not recorded.
            socket.emit(
                "solo_start",
                { playerId, playerName: name, authToken: token || null },
                (res) => {
                    setLoading(false);

                    if (!res?.success) {
                        // One challenge per day: the server rejected the
                        // start because today's game is already finished.
                        if (res?.code === "ALREADY_PLAYED") {
                            setAlreadyPlayed(true);
                            return;
                        }
                        setError(res?.message || "Could not start the game.");
                        return;
                    }

                    setGame(res.state);
                    setQuestions(res.questions || []);
                }
            );
        });
    }

    function handleAsk(questionKey, questionValue) {
        if (!game || game.status !== "playing" || loading) return;

        setError("");
        setLoading(true);

        socket.emit(
            "solo_ask",
            { playerId, questionKey, questionValue },
            (res) => {
                setLoading(false);

                if (!res?.success) {
                    setError(res?.message || "Could not ask.");
                    return;
                }

                setGame(res.state);
            }
        );
    }

    function handleAskFreeText(e) {
        if (e) e.preventDefault();
        if (!game || game.status !== "playing" || loading) return;

        const text = freeQuestion.trim();
        if (!text) return;

        setError("");
        setLoading(true);

        socket.emit(
            "solo_ask",
            { playerId, questionText: text },
            (res) => {
                setLoading(false);

                if (!res?.success) {
                    setError(res?.message || "Could not ask.");
                    return;
                }

                // Server didn't understand -> no turn consumed, keep the question for editing
                if (res.understood === false) {
                    setError(res.message);
                    return;
                }

                setFreeQuestion("");
                setGame(res.state);
            }
        );
    }

    // Click a suggestion -> fill the input to edit/send
    function fillSuggestion(text) {
        setFreeQuestion(text);
        setError("");
    }

    function handleGuess(e) {
        if (e) e.preventDefault();
        if (!game || game.status !== "playing" || loading) return;

        const value = guessInput.trim();

        if (!value) {
            setError("Please enter a Pokémon name or ID.");
            return;
        }

        setError("");
        setLoading(true);

        socket.emit("solo_guess", { playerId, pokemonId: value }, (res) => {
            setLoading(false);

            if (!res?.success) {
                setError(res?.message || "Could not guess.");
                return;
            }

            setGame(res.state);
            setGuessInput("");

            if (res.correct) {
                setLastGuess({ correct: true, score: res.score });
            } else {
                setLastGuess({
                    correct: false,
                    wrongGuesses: res.wrongGuesses,
                });
            }
        });
    }

    function handleGiveUp() {
        if (!game || game.status !== "playing") return;
        if (!window.confirm("Give up and see the answer?")) return;

        socket.emit("solo_giveup", { playerId }, (res) => {
            if (res?.success) {
                setGame(res.state);
            }
        });
    }

    // ---------------- Already played today ----------------
    if (alreadyPlayed && !game) {
        return (
            <>
                <div className="bg-layer" aria-hidden="true">
                    <div className="radial-glow"></div>
                    <div className="radial-glow-2"></div>
                </div>

                <div className="solo-container" ref={entranceRef}>
                    <header className="solo-header" data-entrance>
                        <h1 className="solo-title">DAILY CHALLENGE</h1>
                        <p className="solo-sub">
                            🎯 You&apos;ve already completed
                            today&apos;s challenge!
                        </p>
                    </header>

                    <div className="solo-card solo-result" data-entrance>
                        <h1 className="result-win">See you tomorrow! 🌙</h1>
                        <p className="card-hint">
                            A new challenge unlocks at midnight.
                            {!user && (
                                <>
                                    {" "}
                                    Log in to save your scores and
                                    compete on the leaderboard.
                                </>
                            )}
                        </p>
                        <div className="result-stats">
                            <div>
                                <span>Next challenge in</span>
                                <strong>{countdown}</strong>
                            </div>
                        </div>
                        {!user && (
                            <button
                                className="btn-primary btn-solo-start"
                                onClick={() => navigate("/login")}
                            >
                                🔑 Log In
                            </button>
                        )}
                    </div>

                    <SoloLeaderboard refreshKey={lbRefresh} apiBase={API_BASE} />
                </div>
            </>
        );
    }

    // ---------------- Start screen ----------------
    if (!game) {
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

                <div className="solo-container" ref={entranceRef}>
                    <header className="solo-header" data-entrance>
                        <h1 className="solo-title">DAILY CHALLENGE</h1>
                        <p className="solo-sub">
                            Every game hides a{" "}
                            <span className="highlight">random Pokémon</span>.
                            You have at most{" "}
                            <span className="highlight">20 questions</span>{" "}
                            Yes/No to deduce it.
                            {!user && (
                                <>
                                    {" "}
                                    Playing as guest — scores are only
                                    saved when you{" "}
                                    <strong>log in</strong>.
                                </>
                            )}
                        </p>
                    </header>

                    <div className="solo-card">
                        <h2>Scoring</h2>
                        <ul className="solo-rules">
                            <li>The earlier you guess right, the higher your score (max 1000).</li>
                            <li>Each question costs 45 points.</li>
                            <li>Each wrong guess costs 20 points.</li>
                            <li>A win always earns at least 100 points.</li>
                            <li>Out of 20 questions with no correct guess → you lose.</li>
                        </ul>

                        <div className="form-group">
                            <label className="form-label" htmlFor="soloName">
                                Display name on the leaderboard
                            </label>
                            <input
                                id="soloName"
                                className="form-input"
                                type="text"
                                placeholder="Enter your name..."
                                maxLength="20"
                                value={user?.name || playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                disabled={!!user}
                            />
                            {user && (
                                <p className="card-hint">
                                    Using your account name.
                                </p>
                            )}
                        </div>

                        {error && <p className="solo-error">{error}</p>}

                        <button
                            className="btn-primary btn-solo-start"
                            onClick={handleStart}
                            disabled={loading}
                        >
                            {loading ? "Starting..." : "Start Today's Challenge"}
                        </button>
                    </div>

                    <SoloLeaderboard refreshKey={lbRefresh} apiBase={API_BASE} />

                    <GuestWarningModal
                        open={showGuestWarning}
                        mode="daily"
                        onConfirm={handleGuestConfirm}
                        onGoLogin={() => navigate("/login")}
                        onDismiss={() => setShowGuestWarning(false)}
                    />
                </div>
            </>
        );
    }

    // ---------------- Result screen ----------------
    if (finished) {
        const won = game.status === "won";
        const secret = game.secret || {};

        return (
            <>
                <div className="bg-layer" aria-hidden="true">
                    <div className="radial-glow"></div>
                    <div className="radial-glow-2"></div>
                </div>

                <div className="solo-container" ref={entranceRef}>
                    <div className="solo-card solo-result" data-entrance>
                        <h1 className={won ? "result-win" : "result-lose"}>
                            {won
                                ? "🎉 You guessed it!"
                                : game.status === "gaveup"
                                  ? "You gave up"
                                  : "😢 Out of questions!"}
                        </h1>

                        {secret.sprite && (
                            <img
                                className="secret-sprite"
                                src={secret.sprite}
                                alt={secret.name}
                            />
                        )}

                        <p className="secret-name">
                            {secret.name}{" "}
                            <span className="secret-id">#{secret.id}</span>
                        </p>

                        {secret.types?.length > 0 && (
                            <p className="secret-types">
                                Type: {secret.types.join(" / ")}
                                {secret.generation &&
                                    ` · Generation ${secret.generation}`}
                            </p>
                        )}

                        <div className="result-stats">
                            <div>
                                <span>Questions asked</span>
                                <strong>{game.questionsCount}</strong>
                            </div>
                            <div>
                                <span>Wrong guesses</span>
                                <strong>{game.wrongGuesses}</strong>
                            </div>
                            <div>
                                <span>Score</span>
                                <strong className="score">{game.score}</strong>
                            </div>
                        </div>

                        {game.scored === false && (
                            <p className="card-hint">
                                🔑 You played as a guest — this score was
                                not saved. Log in to compete on the
                                leaderboard.
                            </p>
                        )}

                        <button
                            className="btn-primary btn-solo-start"
                            onClick={handleStart}
                            disabled={loading}
                        >
                            {loading ? "Starting..." : "Play Again"}
                        </button>
                        {game.scored === false && (
                            <button
                                className="btn-secondary btn-solo-start"
                                onClick={() => navigate("/login")}
                            >
                                🔑 Log In
                            </button>
                        )}
                    </div>

                    <SoloLeaderboard refreshKey={lbRefresh} apiBase={API_BASE} />
                </div>
            </>
        );
    }

    // ---------------- Game screen ----------------
    const progress = Math.round(
        (game.questionsCount / game.maxQuestions) * 100
    );

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

            <div className="solo-container" ref={entranceRef}>
                <header className="solo-header" data-entrance>
                    <h1 className="solo-title">DAILY CHALLENGE</h1>
                    <p className="solo-sub">
                        {new Date().toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                        })}{" "}
                        · Left{" "}
                        <span className="highlight">
                            {game.questionsLeft}
                        </span>{" "}
                        questions · {game.wrongGuesses} wrong guesses
                    </p>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </header>

                {error && <p className="solo-error">{error}</p>}

                {lastGuess && !lastGuess.correct && (
                    <p className="guess-feedback wrong">
                        ❌ Wrong guess! {lastGuess.wrongGuesses} wrong{" "}
                        so far (-20 points each).
                    </p>
                )}

                <div className="solo-grid" data-entrance>
                    {/* Question column */}
                    <section className="solo-card">
                        <h2>Ask a Question</h2>
                        <p className="card-hint">
Type your own Yes/No question
                        </p>

                        <form
                            className="free-ask-row"
                            onSubmit={handleAskFreeText}
                        >
                            <input
                                className="form-input free-ask-input"
                                type="text"
                                placeholder="e.g. Is it a fire type?"
                                maxLength={120}
                                value={freeQuestion}
                                onChange={(e) =>
                                    setFreeQuestion(e.target.value)
                                }
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                className="btn-secondary"
                                disabled={loading || !freeQuestion.trim()}
                            >
                                Ask
                            </button>
                        </form>

                        <p className="card-hint suggestion-title">
                            💡 Suggestions — click to fill the question box:
                        </p>

                        <div className="question-list">
                            {questions
                                .filter((q) => !q.needsValue)
                                .map((q) => {
                                    const asked = game.history.some(
                                        (h) => h.key === q.key
                                    );
                                    return (
                                        <button
                                            key={q.key}
                                            className={
                                                "question-btn" +
                                                (asked ? " asked" : "")
                                            }
                                            onClick={() =>
                                                fillSuggestion(q.label)
                                            }
                                            disabled={loading}
                                            title="Click to fill the question box"
                                        >
                                            {q.label}
                                        </button>
                                    );
                                })}
                        </div>

                        <div className="gen-ask">
                            <label htmlFor="genSelect">Ask by generation:</label>
                            <div className="gen-ask-row">
                                <select
                                    id="genSelect"
                                    value={genValue}
                                    onChange={(e) =>
                                        setGenValue(e.target.value)
                                    }
                                >
                                    {GENERATIONS.map((g) => (
                                        <option key={g} value={String(g)}>
                                            Generation {g}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="btn-secondary"
                                    onClick={() =>
                                        fillSuggestion(
                                            `Is this Pokémon from generation ${genValue}?`
                                        )
                                    }
                                    disabled={loading}
                                >
                                    Fill suggestion
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Guess + history column */}
                    <section className="solo-card">
                        <h2>Guess Pokémon</h2>
                        <form
                            className="guess-form"
                            onSubmit={handleGuess}
                            autoComplete="off"
                        >
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Enter name or ID, e.g. pikachu / 25"
                                value={guessInput}
                                onChange={(e) =>
                                    setGuessInput(e.target.value)
                                }
                            />
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={loading}
                            >
                                Guess
                            </button>
                        </form>

                        <h2 className="history-title">Q&A History</h2>
                        {game.history.length === 0 ? (
                            <p className="card-hint">
                                No questions yet. Start deducing!
                            </p>
                        ) : (
                            <ul className="history-list">
                                {game.history.map((h, i) => (
                                    <li key={i} className="history-item">
                                        <span className="history-q">
                                            {i + 1}.{" "}
                                            {h.questionText || h.label}
                                            {h.questionText &&
                                                h.questionText !== h.label && (
                                                    <span className="history-interpreted">
                                                        {" "}
                                                        → understood as: {h.label}
                                                    </span>
                                                )}
                                        </span>
                                        <span
                                            className={
                                                "history-a " +
                                                (h.answer ? "yes" : "no")
                                            }
                                        >
                                            {h.answer ? "Yes" : "No"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <button
                            className="btn-giveup"
                            onClick={handleGiveUp}
                        >
                            Give up, see answer
                        </button>
                    </section>
                </div>
            </div>
        </>
    );
}

export default Solo;