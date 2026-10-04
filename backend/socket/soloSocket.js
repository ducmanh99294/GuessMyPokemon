// =====================================================
// Daily challenge socket handlers (random secret per game)
//
// Events:
// - "solo_start"  ({ playerId, playerName, authToken })       -> create a new game
// - "solo_played_today" ({ playerId, authToken })             -> has today's challenge been finished?
// - "solo_state"  ({ playerId })                              -> get the current state (resume after refresh)
// - "solo_ask"    ({ playerId, questionKey, questionValue, questionText }) -> ask 1 Yes/No question
//   (questionText: free-text question typed by the player; the server figures out the meaning)
// - "solo_guess"  ({ playerId, pokemonId })                   -> guess the pokemon name/ID
// - "solo_giveup" ({ playerId })                              -> give up, reveal the answer
//
// ANTI-CHEAT: authToken (login JWT) is verified server-side. Only
// games started with a valid token are scored on the leaderboard;
// everyone else plays as guest (score not recorded).
//
// QUESTION_DEFINITIONS is defined in
// backend/managers/soloManager.js (single source of truth).
// This file only forwards { key, label, needsValue } to the client,
// NEVER sends the check() fn or any secret info.
// =====================================================

const soloManager = require("../managers/soloManager");
const userManager = require("../managers/userManager");
const dailyPlays = require("../managers/dailyPlays");
const { verifyToken } = require("../middleware/authMiddleware");

// Question list sent to the client (no check fns)
const CLIENT_QUESTIONS = soloManager.QUESTION_DEFINITIONS.map((q) => ({
    key: q.key,
    label: q.label,
    needsValue: !!q.needsValue,
}));

function setupSoloSocket(io) {
    // Resolve { isGuest, ownerId, ownerName } from a login JWT.
    // Missing/invalid/expired token -> guest (score not recorded).
    async function resolveAuth(authToken) {
        if (!authToken) {
            return { isGuest: true, ownerId: null, ownerName: null };
        }
        try {
            const decoded = verifyToken(authToken);
            const user = await userManager.findById(decoded.sub);
            if (user) {
                const uid = user.id || user._id;
                return {
                    isGuest: false,
                    ownerId: String(uid),
                    ownerName: user.name || null,
                };
            }
        } catch {
            // invalid token -> guest game, score not recorded
        }
        return { isGuest: true, ownerId: null, ownerName: null };
    }

    io.on("connection", (socket) => {
        // =========================================
        // START SOLO GAME
        // =========================================
        socket.on("solo_start", async ({ playerId, playerName, authToken }, callback) => {
            try {
                if (!playerId) {
                    throw new Error("Player ID is required");
                }

                socket.playerId = playerId;

                // Verify the login token server-side. Only a valid
                // token makes this a scored game; anything else
                // (missing/invalid/expired) plays as guest.
                const auth = await resolveAuth(authToken);

                const identity = {
                    isGuest: auth.isGuest,
                    ownerId: auth.ownerId,
                    playerId,
                };

                // One challenge per day: block starting a new game if
                // this player already finished today's challenge.
                // (Resuming an in-progress game via "solo_state" is
                // unaffected — only NEW games are blocked.)
                if (await dailyPlays.hasPlayedToday(identity)) {
                    callback?.({
                        success: false,
                        code: "ALREADY_PLAYED",
                        message:
                            "You've already completed today's challenge. Come back tomorrow for a new one!",
                    });
                    return;
                }

                const state = soloManager.startSoloGame(
                    playerId,
                    playerName,
                    auth
                );

                callback?.({
                    success: true,
                    state,
                    questions: CLIENT_QUESTIONS,
                });
            } catch (error) {
                callback?.({
                    success: false,
                    message: error.message,
                });
            }
        });

        // Check whether today's challenge is already finished (so the
        // page can show the "come back tomorrow" screen on load).
        socket.on("solo_played_today", async ({ playerId, authToken }, callback) => {
            try {
                if (!playerId) {
                    throw new Error("Player ID is required");
                }

                const auth = await resolveAuth(authToken);
                const played = await dailyPlays.hasPlayedToday({
                    isGuest: auth.isGuest,
                    ownerId: auth.ownerId,
                    playerId,
                });

                callback?.({ success: true, played });
            } catch (error) {
                callback?.({ success: false, message: error.message });
            }
        });

        socket.on("solo_state", ({ playerId }, callback) => {
            try {
                if (!playerId) {
                    throw new Error("Player ID is required");
                }

                const state = soloManager.getPublicState(playerId);

                callback?.({
                    success: true,
                    state,
                    questions: CLIENT_QUESTIONS,
                });
            } catch (error) {
                callback?.({
                    success: false,
                    message: error.message,
                });
            }
        });

        // =========================================
        // ASK YES/NO QUESTION
        // =========================================
        socket.on(
            "solo_ask",
            async (
                { playerId, questionKey, questionValue, questionText },
                callback
            ) => {
                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    // Free-text question typed by the player
                    if (
                        questionText !== undefined &&
                        questionText !== null &&
                        String(questionText).trim() !== ""
                    ) {
                        const result = await soloManager.askFreeText(
                            playerId,
                            questionText
                        );

                        callback?.({
                            success: true,
                            ...result,
                        });
                        return;
                    }

                    const result = await soloManager.askQuestion(
                        playerId,
                        questionKey,
                        questionValue
                    );

                    callback?.({
                        success: true,
                        ...result,
                    });
                } catch (error) {
                    callback?.({
                        success: false,
                        message: error.message,
                    });
                }
            }
        );

        // =========================================
        // GUESS POKEMON
        // =========================================
        socket.on("solo_guess", async ({ playerId, pokemonId }, callback) => {
            try {
                if (!playerId) {
                    throw new Error("Player ID is required");
                }

                const result = await soloManager.guessPokemon(
                    playerId,
                    pokemonId
                );

                callback?.({
                    success: true,
                    ...result,
                });
            } catch (error) {
                callback?.({
                    success: false,
                    message: error.message,
                });
            }
        });

        // =========================================
        // GIVE UP -> reveal the answer
        // =========================================
        socket.on("solo_giveup", async ({ playerId }, callback) => {
            try {
                if (!playerId) {
                    throw new Error("Player ID is required");
                }

                const state = await soloManager.giveUp(playerId);

                callback?.({
                    success: true,
                    state,
                });
            } catch (error) {
                callback?.({
                    success: false,
                    message: error.message,
                });
            }
        });
    });
}

module.exports = setupSoloSocket;