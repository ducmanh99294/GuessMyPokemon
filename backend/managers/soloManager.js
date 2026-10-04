// =====================================================
// DailyChallengeManager - daily challenge game manager (in-memory)
//
// Every game hides a RANDOM secret Pokémon (no fixed daily answer,
// so knowing one game's answer never helps another game/account).
//
// ANTI-CHEAT:
// - secretId / secretName exist ONLY on the server (the `game` object
//   in the Map below); they are never emitted to the client.
// - The client only receives public state via getPublicState().
// - Yes/No answers are computed on the server from the
//   secret pokemon's metadata.
// - Scores are written to the leaderboard ONLY for logged-in players
//   (verified JWT). Guest games are never recorded.
// - Leaderboard keeps ONE entry per player per day (highest score).
// =====================================================

const pokemonMetadataCache = require("../cache/pokemonMetadataCache");
const leaderboard = require("./leaderboard");
const dailyPlays = require("./dailyPlays");

const MAX_QUESTIONS = 20;
const BASE_SCORE = 1000;
const QUESTION_PENALTY = 45;
const WRONG_GUESS_PENALTY = 20;
const MIN_SCORE = 100;

// In-memory store: playerId -> game
// Each playerId has at most 1 active solo game at a time.
const games = new Map();

// -----------------------------------------------------
// QUESTION DEFINITIONS
// Each question has:
// - key: unique identifier (sent by the client)
// - label: English text shown on the client
// - needsValue: true if the question needs an extra value
//   (e.g. generation needs value 1-9)
// - check(metadata, value): runs ON THE SERVER, returns a boolean
//
// NOTE: soloSocket.js re-imports this list and only sends
// { key, label, needsValue } to the client (never the check fn).
// -----------------------------------------------------
const QUESTION_DEFINITIONS = [
    {
        key: "type_fire",
        label: "Is it a Fire type?",
        check: (m) => m.types.includes("fire"),
        keywords: ["hệ lửa", "lua", "fire"],
    },
    {
        key: "type_water",
        label: "Is it a Water type?",
        check: (m) => m.types.includes("water"),
        keywords: ["hệ nước", "nuoc", "water"],
    },
    {
        key: "type_grass",
        label: "Is it a Grass type?",
        check: (m) => m.types.includes("grass"),
        keywords: ["hệ cỏ", "co", "grass"],
    },
    {
        key: "type_electric",
        label: "Is it an Electric type?",
        check: (m) => m.types.includes("electric"),
        keywords: ["hệ điện", "dien", "electric"],
    },
    {
        key: "type_flying",
        label: "Is it a Flying type?",
        check: (m) => m.types.includes("flying"),
        keywords: ["hệ bay", "bay", "flying", "cánh", "canh"],
    },
    {
        key: "type_dragon",
        label: "Is it a Dragon type?",
        check: (m) => m.types.includes("dragon"),
        keywords: ["hệ rồng", "rong", "dragon"],
    },
    {
        key: "type_psychic",
        label: "Is it a Psychic type?",
        check: (m) => m.types.includes("psychic"),
        keywords: ["tâm linh", "tam linh", "psychic", "ngoại cảm", "ngoai cam"],
    },
    {
        key: "dual_type",
        label: "Does it have 2 types?",
        check: (m) => m.types.length > 1,
        keywords: ["2 hệ", "2 he", "hai hệ", "hai he", "dual", "song hệ", "song he"],
    },
    {
        key: "generation",
        label: "Is it from generation {value}?",
        needsValue: true, // value: 1-9
        check: (m, value) => m.generation === Number(value),
        keywords: ["thế hệ", "the he", "generation", "gen"],
    },
    {
        key: "legendary",
        label: "Is it a Legendary Pokémon?",
        check: (m) => m.legendary === true,
        keywords: ["huyền thoại", "huyen thoai", "legendary"],
    },
    {
        key: "mythical",
        label: "Is it a Mythical Pokémon?",
        check: (m) => m.mythical === true,
        keywords: ["thần thoại", "than thoai", "mythical"],
    },
    {
        key: "baby",
        label: "Is it a baby Pokémon?",
        check: (m) => m.baby === true,
        keywords: ["baby", "em bé", "em be", "sơ sinh", "so sinh"],
    },
    {
        key: "mega",
        label: "Does it have a Mega Evolution?",
        check: (m) => m.mega === true,
        keywords: ["mega", "siêu tiến hóa", "sieu tien hoa"],
    },
    {
        key: "hasEvolution",
        label: "Does it evolve?",
        check: (m) => m.hasEvolution === true,
        keywords: ["tiến hóa", "tien hoa", "tiến hoá", "tien hoa", "evolve", "evolution"],
    },
];

function getDefinition(questionKey) {
    return QUESTION_DEFINITIONS.find((q) => q.key === questionKey);
}

// -----------------------------------------------------
// UNDERSTAND FREE-TEXT QUESTIONS
//
// The player types a free question (English, Vietnamese with or without
// accents all work). The server matches each definition's keywords and
// picks the best match. No match -> not understood,
// and NO turn is consumed.
// -----------------------------------------------------

// Normalize: strip Vietnamese accents so "lửa" and "lua" match,
// remove punctuation.
function normalizeText(s) {
    return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Pre-normalize each definition's keywords (computed once)
for (const def of QUESTION_DEFINITIONS) {
    def._normKeywords = (def.keywords || []).map(normalizeText);
}

const ROMAN_NUMERALS = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5,
    vi: 6, vii: 7, viii: 8, ix: 9,
};

// Extract the generation number 1-9 from the question ("generation 3", "gen 5", "gen iii")
function extractGeneration(normText) {
    const digitMatch = normText.match(/\b([1-9])\b/);

    if (digitMatch) {
        return Number(digitMatch[1]);
    }

    const romanMatch = normText.match(
        /\b(i{1,3}|iv|v|vi{1,3}|ix)\b/
    );

    if (romanMatch && ROMAN_NUMERALS[romanMatch[1]]) {
        return ROMAN_NUMERALS[romanMatch[1]];
    }

    return null;
}

// Understand a free-text question -> { key, value } or null (not understood)
function interpretQuestion(questionText) {
    const norm = normalizeText(questionText);

    if (!norm) {
        return null;
    }

    const padded = ` ${norm} `;
    let best = null;

    for (const def of QUESTION_DEFINITIONS) {
        let hits = 0;
        let longest = 0;

        for (const kw of def._normKeywords) {
            if (kw && padded.includes(` ${kw} `)) {
                hits += 1;
                longest = Math.max(longest, kw.length);
            }
        }

        if (hits === 0) {
            continue;
        }

        // Priority: more keyword hits first, then longer keywords
        // (more specific)
        if (
            !best ||
            hits > best.hits ||
            (hits === best.hits && longest > best.longest)
        ) {
            best = { def, hits, longest };
        }
    }

    if (!best) {
        return null;
    }

    let value = null;

    if (best.def.needsValue) {
        value = extractGeneration(norm);

        if (value === null) {
            // Understood as a generation question but missing the number -> not enough to answer
            return { key: best.def.key, value: null, missingValue: true };
        }
    }

    return { key: best.def.key, value };
}

function pickRandomSecret() {
    const all = pokemonMetadataCache.getAll();

    // Exclude Mega forms from the pool: names like "charizard-mega-x"
    // are very hard to guess by name; keeps the game fair.
    const pool = all.filter((p) => !p.mega);
    const source = pool.length > 0 ? pool : all;

    if (source.length === 0) {
        throw new Error(
            "Pokémon data is not ready yet, please try again later."
        );
    }

    return source[Math.floor(Math.random() * source.length)];
}

// Calendar-day key, e.g. "2026-10-4" (server local time).
// Used to bucket leaderboard entries per day.
function dailyKey(date = new Date()) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// The challenge secret: a RANDOM Pokémon every game.
// Random (not fixed per day) so that learning one game's answer
// gives no advantage in any other game or on another account.
function pickRandomSecret() {
    const all = pokemonMetadataCache.getAll();

    // Exclude Mega forms from the pool: names like "charizard-mega-x"
    // are very hard to guess by name; keeps the game fair.
    const pool = all.filter((p) => !p.mega);
    const source = pool.length > 0 ? pool : all;

    if (source.length === 0) {
        throw new Error(
            "Pokémon data is not ready yet, please try again later."
        );
    }

    return source[Math.floor(Math.random() * source.length)];
}

function normalizeName(value) {
    return String(value).trim().toLowerCase();
}

// Re-fetch the full metadata from cache by secretId.
// (The cache is preloaded in app.js, so it's always there.)
function findSecret(game) {
    const all = pokemonMetadataCache.getAll();
    const found = all.find((p) => p.id === game.secretId);

    if (found) return found;

    // Minimal fallback if the cache was cleared mid-game
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
        throw new Error("You haven't started today's challenge.");
    }

    if (game.status !== "playing") {
        throw new Error("The game has ended, please start a new game.");
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

    // One challenge per day: a finished game (won/lost/gaveup) consumes
    // today's play for this player (logged-in or guest).
    try {
        await dailyPlays.recordPlayed({
            isGuest: game.isGuest,
            ownerId: game.ownerId,
            playerId: game.playerId,
        });
    } catch (error) {
        console.error(
            "[soloManager] daily play record failed:",
            error.message
        );
    }

    // Write to the leaderboard (MongoDB if available, else the JSON file).
    // Wrapped in try/catch so IO errors never interrupt the game.
    // ANTI-CHEAT: guest games are NEVER recorded — only games started
    // with a verified login token count toward the leaderboard.
    if (!game.isGuest && game.ownerId) {
        try {
            await leaderboard.addEntry({
                mode: "daily",
                playerId: game.playerId,
                ownerId: game.ownerId,
                playerName: game.ownerName || game.playerName,
                dailyKey: game.dailyKey,
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
}

// Only reveal the secret AFTER the game ends.
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

function startSoloGame(playerId, playerName, auth) {
    if (!playerId) {
        throw new Error("Player ID is required");
    }

    // auth = { isGuest, ownerId, ownerName } (verified server-side from
    // the JWT in soloSocket). Guests play for fun: their games are
    // never written to the leaderboard.
    const { isGuest = true, ownerId = null, ownerName = null } = auth || {};

    // One active game per playerId: creating a new game
    // replaces the old one (even one in progress).
    const secret = pickRandomSecret();

    const game = {
        playerId,
        playerName: (playerName || "").trim() || "Anonymous player",
        dailyKey: dailyKey(), // calendar day this challenge belongs to
        secretId: secret.id, // SERVER-ONLY: never emitted
        secretName: secret.name, // SERVER-ONLY: never emitted
        isGuest, // true -> score is NOT recorded on the leaderboard
        ownerId, // verified user id (logged-in players only)
        ownerName, // verified display name (logged-in players only)
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
    const def = getDefinition(questionKey);

    if (!def) {
        throw new Error("Invalid question.");
    }

    return answerWithDefinition(playerId, def, questionValue, null);
}

// Free-text ask: the player types their own question.
// - Understood -> answered like a normal question (consumes 1 turn).
// - Not understood / missing value -> NO turn consumed, returns
//   { understood: false, message } for the client to show a hint.
async function askFreeText(playerId, questionText) {
    const text = String(questionText || "").trim();

    if (!text) {
        throw new Error("Please type your question.");
    }

    const interpreted = interpretQuestion(text);

    if (!interpreted) {
        return {
            understood: false,
            message:
                "I didn't understand that question. Try asking about type (fire, water...), " +
                "generation, evolution, legendary... or click a suggestion below.",
        };
    }

    if (interpreted.missingValue) {
        return {
            understood: false,
            message:
                "Which generation do you want to ask about? Example: \"Is this Pokémon from generation 3?\"",
        };
    }

    const def = getDefinition(interpreted.key);

    if (!def) {
        return {
            understood: false,
            message: "I didn't understand that question, try asking differently.",
        };
    }

    const result = await answerWithDefinition(
        playerId,
        def,
        interpreted.value,
        text
    );

    return {
        understood: true,
        interpretedKey: def.key,
        interpretedLabel: result.interpretedLabel,
        ...result,
    };
}

// Shared core: check turns, run check(), write history.
async function answerWithDefinition(
    playerId,
    def,
    questionValue,
    questionText
) {
    const game = getGameOrThrow(playerId);

    if (game.questionsCount >= game.maxQuestions) {
        throw new Error("You are out of 20 questions.");
    }

    if (
        def.needsValue &&
        (questionValue === undefined ||
            questionValue === null ||
            questionValue === "")
    ) {
        throw new Error("This question needs a value (e.g. generation 1-9).");
    }

    const secret = findSecret(game);
    const answer = !!def.check(secret, questionValue);

    const label = def.needsValue
        ? def.label.replace("{value}", String(questionValue))
        : def.label;

    game.questionsAsked.push({
        key: def.key,
        label,
        questionText: questionText || null, // the player's original typed question
        questionValue: questionValue ?? null,
        answer,
    });
    game.questionsCount += 1;

    // Out of 20 questions with no correct guess -> lose, reveal the answer
    if (game.questionsCount >= game.maxQuestions) {
        await finishGame(game, "lost");
    }

    return {
        answer,
        interpretedLabel: label,
        questionsLeft: game.maxQuestions - game.questionsCount,
        state: getPublicState(playerId),
    };
}

async function guessPokemon(playerId, pokemonIdOrName) {
    const game = getGameOrThrow(playerId);

    const input = normalizeName(pokemonIdOrName);

    if (!input) {
        throw new Error("Please enter a Pokémon name or ID.");
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

    // Wrong guess: the game continues, but points are deducted
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

// State sent to the client: NEVER contains secretId/secretName.
// The secret is only revealed when the game has ended.
function getPublicState(playerId) {
    const game = games.get(playerId);

    if (!game) return null;

    const finished = game.status !== "playing";

    return {
        status: game.status,
        dailyKey: game.dailyKey,
        scored: !game.isGuest, // false for guest games: score is not recorded
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
    askFreeText,
    interpretQuestion,
    normalizeText,
    guessPokemon,
    giveUp,
    getPublicState,
    endGame,
    calculateScore,
};