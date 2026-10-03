// SoloLeaderboard.jsx - Bảng xếp hạng solo mode
import { useEffect, useState } from "react";
import "../css/SoloLeaderboard.css";

function formatDate(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    } catch {
        return "";
    }
}

function SoloLeaderboard({ refreshKey, apiBase }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const base = (apiBase || "").replace(/\/$/, "");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetch(`${base}/api/solo/leaderboard/top?limit=10`)
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
    }, [refreshKey, base]);

    if (loading) {
        return (
            <section className="solo-card leaderboard-card">
                <h2>Bảng xếp hạng</h2>
                <p className="card-hint">Đang tải...</p>
            </section>
        );
    }

    return (
        <section className="solo-card leaderboard-card">
            <h2>Bảng xếp hạng solo</h2>
            {rows.length === 0 ? (
                <p className="card-hint">Chưa có ai chơi. Hãy là người đầu tiên!</p>
            ) : (
                <ol className="leaderboard-list">
                    {rows.map((row, i) => (
                        <li key={row.id} className={"lb-row" + (i < 3 ? " lb-top" : "")}>
                            <span className="lb-rank">#{i + 1}</span>
                            <span className="lb-name">{row.playerName}</span>
                            <span className="lb-meta">
                                {row.questionsUsed} câu · {row.wrongGuesses} sai ·{" "}
                                {row.secretName ? `đáp án ${row.secretName}` : ""}
                            </span>
                            <span className="lb-score">{row.score}đ</span>
                            <span className="lb-date">{formatDate(row.createdAt)}</span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

export default SoloLeaderboard;