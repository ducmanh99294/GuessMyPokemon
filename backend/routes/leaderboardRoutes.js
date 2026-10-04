// =====================================================
// Leaderboard routes — Express router per game mode.
//
// Usage:
//   const { createLeaderboardRouter } = require("./leaderboardRoutes");
//   app.use("/api/daily/leaderboard", createLeaderboardRouter("daily"));
//   app.use("/api/pvp/leaderboard",   createLeaderboardRouter("pvp"));
//
// Storage logic lives in backend/managers/leaderboard.js
// (MongoDB when MONGODB_URI exists, else the JSON file).
// =====================================================

const express = require("express");
const leaderboard = require("../managers/leaderboard");

function createLeaderboardRouter(mode) {
    const router = express.Router();

    // GET /top?limit=10 — highest scores of the mode
    router.get("/top", async (req, res) => {
        try {
            const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
            const data = await leaderboard.getTop(limit, mode);
            res.json({ success: true, mode, data });
        } catch (error) {
            console.error(
                `[leaderboardRoutes:${mode}] GET /top failed:`,
                error.message
            );
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    });

    // GET /recent?limit=10 — most recently finished games
    router.get("/recent", async (req, res) => {
        try {
            const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
            const data = await leaderboard.getRecent(limit, mode);
            res.json({ success: true, mode, data });
        } catch (error) {
            console.error(
                `[leaderboardRoutes:${mode}] GET /recent failed:`,
                error.message
            );
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    });

    // GET /player/:playerId — best achievement + stats of one player
    router.get("/player/:playerId", async (req, res) => {
        try {
            const result = await leaderboard.getPlayerBest(
                req.params.playerId,
                mode
            );

            if (!result) {
                return res.json({ success: true, mode, best: null });
            }

            res.json({ success: true, mode, ...result });
        } catch (error) {
            console.error(
                `[leaderboardRoutes:${mode}] GET /player failed:`,
                error.message
            );
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    });

    return router;
}

module.exports = { createLeaderboardRouter };
