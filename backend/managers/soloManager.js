// =====================================================
// SoloManager - quản lý game solo (in-memory)
//
// ANTI-CHEAT:
// - secretId / secretName CHỈ tồn tại ở server (object `game`
//   trong Map bên dưới), không bao giờ được emit về client.
// - Client chỉ nhận public state qua getPublicState().
// - Đáp án các câu hỏi Yes/No được tính ở server dựa trên
//   metadata của pokemon bí mật.
// =====================================================

const pokemonMetadataCache = require("../cache/pokemonMetadataCache");
const soloLeaderboard = require("./soloLeaderboard");

const MAX_QUESTIONS = 20;
const BASE_SCORE = 1000;
const QUESTION_PENALTY = 45;
const WRONG_GUESS_PENALTY = 20;
const MIN_SCORE = 100;

// In-memory store: playerId -> game
// Mỗi playerId chỉ có tối đa 1 game solo active tại 1 thời điểm.
const games = new Map();

// -----------------------------------------------------
// QUESTION DEFINITIONS
// Mỗi câu hỏi gồm:
// - key: định danh duy nhất (client gửi lên)
// - label: tiếng Việt hiển thị ở client
// - needsValue: true nếu câu hỏi cần thêm giá trị
//   (ví dụ generation cần value 1-9)
// - check(metadata, value): chạy Ở SERVER, trả về boolean
//
// NOTE: soloSocket.js import lại danh sách này và chỉ gửi
// { key, label, needsValue } về client (không gửi hàm check).
// -----------------------------------------------------
const QUESTION_DEFINITIONS = [
    {
        key: "type_fire",
        label: "Có hệ Lửa (Fire) không?",
        check: (m) => m.types.includes("fire"),
    },
    {
        key: "type_water",
        label: "Có hệ Nước (Water) không?",
        check: (m) => m.types.includes("water"),
    },
    {
        key: "type_grass",
        label: "Có hệ Cỏ (Grass) không?",
        check: (m) => m.types.includes("grass"),
    },
    {
        key: "type_electric",
        label: "Có hệ Điện (Electric) không?",
        check: (m) => m.types.includes("electric"),
    },
    {
        key: "type_flying",
        label: "Có hệ Bay (Flying) không?",
        check: (m) => m.types.includes("flying"),
    },
    {
        key: "type_dragon",
        label: "Có hệ Rồng (Dragon) không?",
        check: (m) => m.types.includes("dragon"),
    },
    {
        key: "type_psychic",
        label: "Có hệ Tâm linh (Psychic) không?",
        check: (m) => m.types.includes("psychic"),
    },
    {
        key: "dual_type",
        label: "Có 2 hệ không?",
        check: (m) => m.types.length > 1,
    },
    {
        key: "generation",
        label: "Thuộc thế hệ {value}?",
        needsValue: true, // value: 1-9
        check: (m, value) => m.generation === Number(value),
    },
    {
        key: "legendary",
        label: "Là Pokémon huyền thoại (Legendary)?",
        check: (m) => m.legendary === true,
    },
    {
        key: "mythical",
        label: "Là Pokémon thần thoại (Mythical)?",
        check: (m) => m.mythical === true,
    },
    {
        key: "baby",
        label: "Là Pokémon baby?",
        check: (m) => m.baby === true,
    },
    {
        key: "mega",
        label: "Có dạng Mega Evolution?",
        check: (m) => m.mega === true,
    },
    {
        key: "hasEvolution",
        label: "Có tiến hóa?",
        check: (m) => m.hasEvolution === true,
    },
];

function getDefinition(questionKey) {
    return QUESTION_DEFINITIONS.find((q) => q.key === questionKey);
}

function pickRandomSecret() {
    const all = pokemonMetadataCache.getAll();

    // Loại Mega form khỏi pool: tên dạng "charizard-mega-x"
    // rất khó đoán bằng tên, giữ game công bằng.
    const pool = all.filter((p) => !p.mega);
    const source = pool.length > 0 ? pool : all;

    if (source.length === 0) {
        throw new Error(
            "Dữ liệu Pokémon chưa sẵn sàng, vui lòng thử lại sau."
        );
    }

    return source[Math.floor(Math.random() * source.length)];
}

function normalizeName(value) {
    return String(value).trim().toLowerCase();
}

// Lấy lại metadata đầy đủ từ cache theo secretId.
// (Cache đã preload ở app.js nên luôn có.)
function findSecret(game) {
    const all = pokemonMetadataCache.getAll();
    const found = all.find((p) => p.id === game.secretId);

    if (found) return found;

    // Fallback tối thiểu nếu cache bị clear giữa chừng
    return {
        id: game.secretId,
        name: game.secretName,
        types: [],
        generation: null,
        legendary: false,
        mythical: false,
        baby: false,
        mega: false,
        hasEvolution: false,
        sprite: null,
    };
}

function getGameOrThrow(playerId) {
    const game = games.get(playerId);

    if (!game) {
        throw new Error("Bạn chưa bắt đầu game solo.");
    }

    if (game.status !== "playing") {
        throw new Error("Game đã kết thúc, hãy bắt đầu game mới.");
    }

    return game;
}

function calculateScore(game) {
    return Math.max(
        MIN_SCORE,
        BASE_SCORE -
            game.questionsCount * QUESTION_PENALTY -
            game.wrongGuesses * WRONG_GUESS_PENALTY
    );
}

async function finishGame(game, status) {
    game.status = status; // won | lost | gaveup
    game.endTime = Date.now();
    game.score = status === "won" ? calculateScore(game) : 0;

    // Ghi vào leaderboard (MongoDB nếu có, không thì file JSON).
    // Bọc try/catch để lỗi IO không làm gián đoạn game.
    try {
        await soloLeaderboard.addEntry({
            playerId: game.playerId,
            playerName: game.playerName,
            score: game.score,
            questionsUsed: game.questionsCount,
            wrongGuesses: game.wrongGuesses,
            won: status === "won",
            secretName: game.secretName,
            secretId: game.secretId,
            durationSeconds: Math.floor(
                (game.endTime - game.startTime) / 1000
            ),
        });
    } catch (error) {
        console.error(
            "[soloManager] leaderboard write failed:",
            error.message
        );
    }
}

// Chỉ reveal secret SAU KHI game kết thúc.
function revealSecret(game) {
    const secret = findSecret(game);

    return {
        id: secret.id,
        name: secret.name,
        sprite: secret.sprite || null,
        types: secret.types || [],
        generation: secret.generation ?? null,
    };
}

// =====================================================
// PUBLIC API
// =====================================================

function startSoloGame(playerId, playerName) {
    if (!playerId) {
        throw new Error("Player ID is required");
    }

    // Mỗi playerId chỉ 1 game active: tạo game mới sẽ
    // thay thế game cũ (kể cả game đang chơi dở).
    const secret = pickRandomSecret();

    const game = {
        playerId,
        playerName: (playerName || "").trim() || "Người chơi ẩn danh",
        secretId: secret.id, // SERVER-ONLY: không bao giờ emit
        secretName: secret.name, // SERVER-ONLY: không bao giờ emit
        questionsAsked: [], // { key, label, questionValue, answer }
        questionsCount: 0,
        maxQuestions: MAX_QUESTIONS,
        wrongGuesses: 0,
        status: "playing", // playing | won | lost | gaveup
        startTime: Date.now(),
        endTime: null,
        score: null,
    };

    games.set(playerId, game);

    return getPublicState(playerId);
}

async function askQuestion(playerId, questionKey, questionValue) {
    const game = getGameOrThrow(playerId);

    if (game.questionsCount >= game.maxQuestions) {
        throw new Error("Đã hết 20 câu hỏi.");
    }

    const def = getDefinition(questionKey);

    if (!def) {
        throw new Error("Câu hỏi không hợp lệ.");
    }

    if (
        def.needsValue &&
        (questionValue === undefined ||
            questionValue === null ||
            questionValue === "")
    ) {
        throw new Error("Câu hỏi này cần giá trị (ví dụ: thế hệ 1-9).");
    }

    const secret = findSecret(game);
    const answer = !!def.check(secret, questionValue);

    const label = def.needsValue
        ? def.label.replace("{value}", String(questionValue))
        : def.label;

    game.questionsAsked.push({
        key: def.key,
        label,
        questionValue: questionValue ?? null,
        answer,
    });
    game.questionsCount += 1;

    // Hết 20 câu mà chưa đoán đúng -> thua, reveal đáp án
    if (game.questionsCount >= game.maxQuestions) {
        await finishGame(game, "lost");
    }

    return {
        answer,
        questionsLeft: game.maxQuestions - game.questionsCount,
        state: getPublicState(playerId),
    };
}

async function guessPokemon(playerId, pokemonIdOrName) {
    const game = getGameOrThrow(playerId);

    const input = normalizeName(pokemonIdOrName);

    if (!input) {
        throw new Error("Vui lòng nhập tên hoặc ID Pokémon.");
    }

    const secret = findSecret(game);

    const correct =
        normalizeName(secret.name) === input ||
        String(secret.id) === input;

    if (correct) {
        await finishGame(game, "won");

        return {
            correct: true,
            score: game.score,
            state: getPublicState(playerId),
        };
    }

    // Đoán sai: vẫn tiếp tục, nhưng bị trừ điểm
    game.wrongGuesses += 1;

    return {
        correct: false,
        wrongGuesses: game.wrongGuesses,
        questionsLeft: game.maxQuestions - game.questionsCount,
        state: getPublicState(playerId),
    };
}

async function giveUp(playerId) {
    const game = getGameOrThrow(playerId);
    await finishGame(game, "gaveup");

    return getPublicState(playerId);
}

// State gửi về client: KHÔNG BAO GIỜ chứa secretId/secretName.
// Secret chỉ được reveal khi game đã kết thúc.
function getPublicState(playerId) {
    const game = games.get(playerId);

    if (!game) return null;

    const finished = game.status !== "playing";

    return {
        status: game.status,
        questionsCount: game.questionsCount,
        questionsLeft: game.maxQuestions - game.questionsCount,
        maxQuestions: game.maxQuestions,
        history: game.questionsAsked,
        wrongGuesses: game.wrongGuesses,
        score: game.score,
        elapsedSeconds: Math.floor(
            ((game.endTime || Date.now()) - game.startTime) / 1000
        ),
        secret: finished ? revealSecret(game) : null,
    };
}

function endGame(playerId) {
    games.delete(playerId);
}

module.exports = {
    MAX_QUESTIONS,
    QUESTION_DEFINITIONS,
    startSoloGame,
    askQuestion,
    guessPokemon,
    giveUp,
    getPublicState,
    endGame,
    calculateScore,
};