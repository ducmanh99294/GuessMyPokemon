// =====================================================
// Solo leaderboard routes (Express REST)
// Base: /api/solo/leaderboard
//
// - GET /top?limit=10     -> top điểm cao nhất
// - GET /recent?limit=10  -> các ván gần đây nhất
// - GET /me/:playerId     -> thành tích tốt nhất của 1 người chơi
// =====================================================

const express = require("express");
const router = express.Router();

const soloLeaderboard = require("../managers/soloLeaderboard");

function parseLimit(value, fallback = 10) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(50, Math.floor(n));
}

// Top điểm cao
router.get("/top", async (req, res) => {
    try {
        const data = await soloLeaderboard.getTop(parseLimit(req.query.limit));
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Các ván gần đây
router.get("/recent", async (req, res) => {
    try {
        const data = await soloLeaderboard.getRecent(parseLimit(req.query.limit));
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Thành tích của 1 người chơi
router.get("/me/:playerId", async (req, res) => {
    try {
        const data = await soloLeaderboard.getPlayerBest(req.params.playerId);

        if (!data) {
            return res.json({ success: true, data: null, message: "Chưa có dữ liệu." });
        }

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;