// =====================================================
// Solo socket handlers - chế độ chơi solo với máy
//
// Events:
// - "solo_start"  ({ playerId })                              -> tạo game mới
// - "solo_state"  ({ playerId })                              -> lấy state hiện tại (resume sau F5)
// - "solo_ask"    ({ playerId, questionKey, questionValue })   -> hỏi 1 câu Yes/No
// - "solo_guess"  ({ playerId, pokemonId })                   -> đoán tên/ID pokemon
// - "solo_giveup" ({ playerId })                              -> bỏ cuộc, reveal đáp án
//
// QUESTION_DEFINITIONS được định nghĩa ở
// backend/managers/soloManager.js (single source of truth).
// File này chỉ forward { key, label, needsValue } về client,
// KHÔNG BAO GIỜ gửi hàm check() hay thông tin secret.
// =====================================================

const soloManager = require("../managers/soloManager");

// Danh sách câu hỏi gửi về client (không chứa hàm check)
const CLIENT_QUESTIONS = soloManager.QUESTION_DEFINITIONS.map((q) => ({
    key: q.key,
    label: q.label,
    needsValue: !!q.needsValue,
}));

function setupSoloSocket(io) {
    io.on("connection", (socket) => {
        // =========================================
        // START SOLO GAME
        // =========================================
        socket.on("solo_start", ({ playerId, playerName }, callback) => {
            try {
                if (!playerId) {
                    throw new Error("Player ID is required");
                }

                socket.playerId = playerId;

                const state = soloManager.startSoloGame(playerId, playerName);

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
        // GET CURRENT STATE (resume sau F5)
        // =========================================
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
            async ({ playerId, questionKey, questionValue }, callback) => {
                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
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
        // GIVE UP -> reveal đáp án
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