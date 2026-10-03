// Solo.jsx - Trang chơi solo với máy
// Luật: hỏi tối đa 20 câu Yes/No, đoán đúng càng sớm càng nhiều điểm.
// Điểm = max(100, 1000 - sốCâuHỏi*45 - sốLầnĐoánSai*20)
import { useEffect, useState } from "react";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { useAuth } from "../context/AuthContext";
import SoloLeaderboard from "../components/SoloLeaderboard";
import "../css/Solo.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function Solo() {
    const { user } = useAuth(); // null nếu chơi khách

    const [game, setGame] = useState(null); // public state từ server
    const [questions, setQuestions] = useState([]); // { key, label, needsValue }
    const [genValue, setGenValue] = useState("1");
    const [guessInput, setGuessInput] = useState("");
    const [playerName, setPlayerName] = useState(
        () => localStorage.getItem("pokemon_solo_name") || ""
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastGuess, setLastGuess] = useState(null); // { correct, ... }
    const [lbRefresh, setLbRefresh] = useState(0);

    // Đã đăng nhập -> game gắn với tài khoản (mỗi tài khoản 1 Pokémon
    // bí mật, chống gian lận + dồn điểm leaderboard theo account).
    // Chưa đăng nhập -> chơi khách bằng playerId ẩn danh như cũ.
    const playerId = user ? `user_${user.id}` : getPlayerId();
    const finished = game && game.status !== "playing";

    // Refresh leaderboard mỗi khi game kết thúc
    useEffect(() => {
        if (finished) setLbRefresh((v) => v + 1);
    }, [finished]);

    // Resume game đang chơi dở nếu user F5 giữa chừng
    useEffect(() => {
        function fetchState() {
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
        setError("");
        setLastGuess(null);
        setGuessInput("");
        setLoading(true);

        const name = (user?.name || playerName).trim();
        if (!user && name) localStorage.setItem("pokemon_solo_name", name);

        ensureConnected(() => {
            socket.emit("solo_start", { playerId, playerName: name }, (res) => {
                setLoading(false);

                if (!res?.success) {
                    setError(res?.message || "Không thể bắt đầu game.");
                    return;
                }

                setGame(res.state);
                setQuestions(res.questions || []);
            });
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
                    setError(res?.message || "Không thể hỏi.");
                    return;
                }

                setGame(res.state);
            }
        );
    }

    function handleGuess(e) {
        if (e) e.preventDefault();
        if (!game || game.status !== "playing" || loading) return;

        const value = guessInput.trim();

        if (!value) {
            setError("Vui lòng nhập tên hoặc ID Pokémon.");
            return;
        }

        setError("");
        setLoading(true);

        socket.emit("solo_guess", { playerId, pokemonId: value }, (res) => {
            setLoading(false);

            if (!res?.success) {
                setError(res?.message || "Không thể đoán.");
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
        if (!window.confirm("Bỏ cuộc và xem đáp án?")) return;

        socket.emit("solo_giveup", { playerId }, (res) => {
            if (res?.success) {
                setGame(res.state);
            }
        });
    }

    // ---------------- Màn hình bắt đầu ----------------
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

                <div className="solo-container">
                    <header className="solo-header">
                        <h1 className="solo-title">CHƠI SOLO</h1>
                        <p className="solo-sub">
                            Máy đã chọn 1 Pokémon bí mật. Bạn có tối đa{" "}
                            <span className="highlight">20 câu hỏi</span> Yes/No
                            để suy luận.
                        </p>
                    </header>

                    <div className="solo-card">
                        <h2>Cách tính điểm</h2>
                        <ul className="solo-rules">
                            <li>Đoán đúng càng sớm, điểm càng cao (tối đa 1000).</li>
                            <li>Mỗi câu hỏi trừ 45 điểm.</li>
                            <li>Mỗi lần đoán sai trừ 20 điểm.</li>
                            <li>Thắng luôn được tối thiểu 100 điểm.</li>
                            <li>Hết 20 câu mà chưa đoán đúng → thua.</li>
                        </ul>

                        <div className="form-group">
                            <label className="form-label" htmlFor="soloName">
                                Tên hiển thị trên bảng xếp hạng
                            </label>
                            <input
                                id="soloName"
                                className="form-input"
                                type="text"
                                placeholder="Nhập tên của bạn..."
                                maxLength="20"
                                value={user?.name || playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                disabled={!!user}
                            />
                            {user && (
                                <p className="card-hint">
                                    Đang dùng tên tài khoản của bạn.
                                </p>
                            )}
                        </div>

                        {error && <p className="solo-error">{error}</p>}

                        <button
                            className="btn-primary btn-solo-start"
                            onClick={handleStart}
                            disabled={loading}
                        >
                            {loading ? "Đang bắt đầu..." : "Bắt đầu chơi solo"}
                        </button>
                    </div>

                    <SoloLeaderboard refreshKey={lbRefresh} apiBase={API_BASE} />
                </div>
            </>
        );
    }

    // ---------------- Màn hình kết quả ----------------
    if (finished) {
        const won = game.status === "won";
        const secret = game.secret || {};

        return (
            <>
                <div className="bg-layer" aria-hidden="true">
                    <div className="radial-glow"></div>
                    <div className="radial-glow-2"></div>
                </div>

                <div className="solo-container">
                    <div className="solo-card solo-result">
                        <h1 className={won ? "result-win" : "result-lose"}>
                            {won
                                ? "🎉 Đoán đúng rồi!"
                                : game.status === "gaveup"
                                  ? "Bạn đã bỏ cuộc"
                                  : "😢 Hết lượt hỏi!"}
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
                                Hệ: {secret.types.join(" / ")}
                                {secret.generation &&
                                    ` · Thế hệ ${secret.generation}`}
                            </p>
                        )}

                        <div className="result-stats">
                            <div>
                                <span>Số câu đã hỏi</span>
                                <strong>{game.questionsCount}</strong>
                            </div>
                            <div>
                                <span>Đoán sai</span>
                                <strong>{game.wrongGuesses}</strong>
                            </div>
                            <div>
                                <span>Điểm</span>
                                <strong className="score">{game.score}</strong>
                            </div>
                        </div>

                        <button
                            className="btn-primary btn-solo-start"
                            onClick={handleStart}
                            disabled={loading}
                        >
                            {loading ? "Đang bắt đầu..." : "Chơi lại"}
                        </button>
                    </div>

                    <SoloLeaderboard refreshKey={lbRefresh} apiBase={API_BASE} />
                </div>
            </>
        );
    }

    // ---------------- Màn hình chơi ----------------
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

            <div className="solo-container">
                <header className="solo-header">
                    <h1 className="solo-title">CHƠI SOLO</h1>
                    <p className="solo-sub">
                        Còn{" "}
                        <span className="highlight">
                            {game.questionsLeft}
                        </span>{" "}
                        câu hỏi · Đoán sai {game.wrongGuesses} lần
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
                        ❌ Đoán sai rồi! Đã đoán sai {lastGuess.wrongGuesses}{" "}
                        lần (-20 điểm mỗi lần).
                    </p>
                )}

                <div className="solo-grid">
                    {/* Cột câu hỏi */}
                    <section className="solo-card">
                        <h2>Đặt câu hỏi</h2>
                        <p className="card-hint">
                            Bấm vào câu hỏi để máy trả lời Có / Không
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
                                            onClick={() => handleAsk(q.key)}
                                            disabled={loading}
                                        >
                                            {q.label}
                                        </button>
                                    );
                                })}
                        </div>

                        <div className="gen-ask">
                            <label htmlFor="genSelect">Hỏi theo thế hệ:</label>
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
                                            Thế hệ {g}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="btn-secondary"
                                    onClick={() =>
                                        handleAsk("generation", genValue)
                                    }
                                    disabled={loading}
                                >
                                    Hỏi
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Cột đoán + lịch sử */}
                    <section className="solo-card">
                        <h2>Đoán Pokémon</h2>
                        <form
                            className="guess-form"
                            onSubmit={handleGuess}
                            autoComplete="off"
                        >
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Nhập tên hoặc ID, vd: pikachu / 25"
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
                                Đoán
                            </button>
                        </form>

                        <h2 className="history-title">Lịch sử hỏi đáp</h2>
                        {game.history.length === 0 ? (
                            <p className="card-hint">
                                Chưa hỏi câu nào. Hãy bắt đầu suy luận!
                            </p>
                        ) : (
                            <ul className="history-list">
                                {game.history.map((h, i) => (
                                    <li key={i} className="history-item">
                                        <span className="history-q">
                                            {i + 1}. {h.label}
                                        </span>
                                        <span
                                            className={
                                                "history-a " +
                                                (h.answer ? "yes" : "no")
                                            }
                                        >
                                            {h.answer ? "Có" : "Không"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <button
                            className="btn-giveup"
                            onClick={handleGiveUp}
                        >
                            Bỏ cuộc, xem đáp án
                        </button>
                    </section>
                </div>
            </div>
        </>
    );
}

export default Solo;