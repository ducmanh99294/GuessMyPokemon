// SoloLeaderboard.jsx - Leaderboard by game mode
// mode="daily" (default): daily challenge | mode="pvp": battle humans
import { useEffect, useState } from "react";
import "../css/SoloLeaderboard.css";

function formatDate(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" });
    } catch {
        return "";
    }
}

function SoloLeaderboard({ refreshKey, apiBase, mode = "daily", limit = 10 }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const base = (apiBase || "").replace(/\/$/, "");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetch(`${base}/api/${mode}/leaderboard/top?limit=${limit}`)
            .then((r) => r.json())
            .then((json) => {
                if (!cancelled && json?.success) setRows(json.data || []);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [refreshKey, base, mode, limit]);

    if (loading) {
        return (
            <section className="solo-card leaderboard-card">
                <h2>Leaderboard</h2>
                <p className="card-hint">Loading...</p>
            </section>
        );
    }

    return (
        <section className="solo-card leaderboard-card">
            <h2>{mode === "pvp" ? "PVP Leaderboard" : "Daily Challenge"}</h2>
            {rows.length === 0 ? (
                <p className="card-hint">No one has played yet. Be the first!</p>
            ) : (
                <ol className="leaderboard-list">
                    {rows.map((row, i) => (
                        <li key={row.id} className={"lb-row" + (i < 3 ? " lb-top" : "")}>
                            <span className="lb-rank">#{i + 1}</span>
                            <span className="lb-name">{row.playerName}</span>
                            <span className="lb-meta">
                                {mode === "pvp" ? (
                                    <>
                                        {row.guesses} guesses ·{" "}
                                        {row.won ? "won" : "lost"}
                                        {row.opponentName
                                            ? ` vs ${row.opponentName}`
                                            : ""}
                                    </>
                                ) : (
                                    <>
                                        {row.questionsUsed} questions ·{" "}
                                        {row.wrongGuesses} sai ·{" "}
                                        {row.secretName
                                            ? `answer ${row.secretName}`
                                            : ""}
                                    </>
                                )}
                            </span>
                            <span className="lb-score">{row.score} pts</span>
                            <span className="lb-date">{formatDate(row.createdAt)}</span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

export default SoloLeaderboard;