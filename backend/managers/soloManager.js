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
const pokemonFilterService = require("../services/pokemonFilterService");
const leaderboard = require("./leaderboard");
const dailyPlays = require("./dailyPlays");

const MAX_QUESTIONS = 20;
const BASE_SCORE = 1000;
const QUESTION_PENALTY = 45;
const WRONG_GUESS_PENALTY = 20;
const MIN_SCORE = 100;

// Filter shape shared with the PvP FilterPanel so the same component
// can be reused on the Daily Challenge page.
const DEFAULT_SOLO_FILTERS = {
    type: [],
    generation: [],
    legendary: null,
    mythical: null,
    hasEvolution: null,
    mega: null,
    evolutionForms: null,
    effective: [],
    noEffect: [],
    notEffect: [],
    superEffect: [],
};

const VALID_SOLO_FILTER_KEYS = Object.keys(DEFAULT_SOLO_FILTERS);

// National Dex numbers of the 3 starter Pokémon of each generation
// (fixed by Game Freak, safe to hardcode).
const STARTER_IDS = [
    1, 4, 7, // gen 1: Bulbasaur, Charmander, Squirtle
    152, 155, 158, // gen 2: Chikorita, Cyndaquil, Totodile
    252, 255, 258, // gen 3: Treecko, Torchic, Mudkip
    387, 390, 393, // gen 4: Turtwig, Chimchar, Piplup
    495, 498, 501, // gen 5: Snivy, Tepig, Oshawott
    650, 653, 656, // gen 6: Chespin, Fennekin, Froakie
    722, 725, 728, // gen 7: Rowlet, Litten, Popplio
    810, 813, 816, // gen 8: Grookey, Scorbunny, Sobble
    906, 909, 912, // gen 9: Sprigatito, Fuecoco, Quaxly
];

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
        key: "dual_type",
        label: "Does it have 2 types?",
        check: (m) => m.types.length > 1,
        keywords: ["2 hệ", "2 he", "hai hệ", "hai he", "dual", "song hệ", "song he", "đa hệ", "da he", "nhiều hệ", "nhieu he", "multi type"],
    },
    {
        key: "generation",
        label: "Is it from generation {value}?",
        needsValue: true, // value: 1-9
        check: (m, value) => m.generation === Number(value),
        keywords: ["thế hệ", "the he", "generation", "gen"],
    },
    {
        key: "generation_range",
        label: "Is it from generation {from} to {to}?",
        needsValue: true, // value: { from, to }
        valueKind: "genRange",
        check: (m, value) => {
            const from = Number(value?.from);
            const to = Number(value?.to);
            return m.generation >= from && m.generation <= to;
        },
        // Reached via the generation-range override in interpretQuestion
        // ("from gen 2 to 5", "từ gen 2 đến 5", ...), not just these keywords.
        keywords: ["từ gen", "tu gen", "from gen", "đến gen", "den gen", "to gen", "between"],
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
    {
        key: "starter",
        label: "Is it a starter Pokémon?",
        // Starter = one of the 3 partner Pokémon of each generation,
        // identified by National Dex number (fixed by Game Freak).
        check: (m) => STARTER_IDS.includes(m.id),
        keywords: ["starter", "khởi đầu", "khoi dau", "ban đầu", "ban dau", "partner pokemon"],
    },
];

function getDefinition(questionKey) {
    return QUESTION_DEFINITIONS.find((q) => q.key === questionKey);
}

// -----------------------------------------------------
// ALL 18 TYPE QUESTIONS (generated)
// "Is it a <type> type?" — English + Vietnamese keywords.
// -----------------------------------------------------
const TYPE_QUESTIONS = [
    { type: "normal", label: "Is it a Normal type?", keywords: ["normal", "thường", "thuong"] },
    { type: "fire", label: "Is it a Fire type?", keywords: ["hệ lửa", "lua", "fire"] },
    { type: "water", label: "Is it a Water type?", keywords: ["hệ nước", "nuoc", "water"] },
    { type: "electric", label: "Is it an Electric type?", keywords: ["hệ điện", "dien", "electric"] },
    { type: "grass", label: "Is it a Grass type?", keywords: ["hệ cỏ", "co", "grass"] },
    { type: "ice", label: "Is it an Ice type?", keywords: ["hệ băng", "bang", "ice"] },
    { type: "fighting", label: "Is it a Fighting type?", keywords: ["hệ giác đấu", "giac dau", "fighting", "fight"] },
    { type: "poison", label: "Is it a Poison type?", keywords: ["hệ độc", "doc", "poison"] },
    { type: "ground", label: "Is it a Ground type?", keywords: ["hệ đất", "dat", "ground"] },
    { type: "flying", label: "Is it a Flying type?", keywords: ["hệ bay", "bay", "flying", "cánh", "canh"] },
    { type: "psychic", label: "Is it a Psychic type?", keywords: ["tâm linh", "tam linh", "psychic", "ngoại cảm", "ngoai cam"] },
    { type: "bug", label: "Is it a Bug type?", keywords: ["hệ bọ", "bo", "hệ sâu", "sau", "bug"] },
    { type: "rock", label: "Is it a Rock type?", keywords: ["hệ đá", "da", "rock"] },
    { type: "ghost", label: "Is it a Ghost type?", keywords: ["hệ ma", "ma", "ghost"] },
    { type: "dragon", label: "Is it a Dragon type?", keywords: ["hệ rồng", "rong", "dragon"] },
    { type: "dark", label: "Is it a Dark type?", keywords: ["hệ bóng tối", "bong toi", "bóng đêm", "bong dem", "dark"] },
    { type: "steel", label: "Is it a Steel type?", keywords: ["hệ thép", "thep", "steel"] },
    { type: "fairy", label: "Is it a Fairy type?", keywords: ["hệ tiên", "tien", "fairy"] },
];

for (const tq of TYPE_QUESTIONS) {
    QUESTION_DEFINITIONS.push({
        key: `type_${tq.type}`,
        label: tq.label,
        check: (m) => (m.types || []).includes(tq.type),
        keywords: tq.keywords,
    });
}

// -----------------------------------------------------
// TYPE-EFFECTIVENESS QUESTIONS (generated, phase-1 only)
// "Is it weak to fire?" / "Does it resist fire?" /
// "Is it immune to electric?" / "Does fire do normal damage to it?"
//
// These have NO phase-2 keywords on purpose: they are reached
// via interpretEffectiveness(), which runs BEFORE the generic
// keyword matcher so that "fire" alone can never hijack them
// into "Is it a Fire type?".
// -----------------------------------------------------
const EFFECTIVENESS_QUESTIONS = [
    {
        key: "weak_to",
        label: "Is it weak to {value} type?",
        signals: ["weak to", "weak", "weakness", "yeu", "2x", "x2", "super effective", "supereffective", "sieu hieu qua"],
        // X-type moves deal 2x or more damage to it
        check: (eff) => !!eff && eff.multiplier >= 2,
    },
    {
        key: "resists",
        label: "Does it resist {value} type?",
        signals: ["resist", "khang", "not very effective"],
        // X-type moves deal 0.5x damage to it
        check: (eff) => !!eff && eff.multiplier > 0 && eff.multiplier < 1,
    },
    {
        key: "immune_to",
        label: "Is it immune to {value} type?",
        signals: ["immune", "mien nhiem", "no effect", "no damage", "does not affect", "doesnt affect"],
        // X-type moves deal no damage to it
        check: (eff) => !!eff && eff.multiplier === 0,
    },
    {
        key: "normal_vs",
        label: "Does {value} type do normal damage to it?",
        signals: ["normal damage", "normal with", "normal against", "normal to", "1x", "x1"],
        // X-type moves deal exactly 1x damage to it
        check: (eff) => !!eff && eff.multiplier === 1,
    },
];

for (const eq of EFFECTIVENESS_QUESTIONS) {
    QUESTION_DEFINITIONS.push({
        key: eq.key,
        label: eq.label,
        needsValue: true, // value: type name, e.g. "fire"
        valueKind: "type",
        check: (m, value) =>
            eq.check(m.effectiveness?.[String(value).toLowerCase()]),
        keywords: [],
    });
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

// Signals for a generation RANGE question ("from gen 2 to 5",
// "từ gen 2 đến 5", "between gen 2 and 5"). Normalized text.
const GEN_RANGE_SIGNALS = ["from", "tu", "to", "den", "between"];

// Extract { from, to } from "from gen 2 to 5" / "từ gen 2 đến 5".
// Returns null when it is not a range question.
function extractGenerationRange(normText) {
    const padded = ` ${normText} `;
    const hasSignal = GEN_RANGE_SIGNALS.some((kw) =>
        padded.includes(` ${kw} `)
    );

    if (!hasSignal) {
        return null;
    }

    const nums = normText.match(/\b([1-9])\b/g);

    if (!nums || nums.length < 2) {
        return null;
    }

    const a = Number(nums[0]);
    const b = Number(nums[1]);

    return { from: Math.min(a, b), to: Math.max(a, b) };
}

// -----------------------------------------------------
// TYPE-EFFECTIVENESS QUESTIONS (phase 1 of interpretation)
//
// "x2 with fire", "weak to fire", "super effective with fire",
// "yếu hệ lửa" ... all ask whether the secret takes 2x+ damage
// from that type — NOT "is it a fire type?".
// This runs BEFORE the generic keyword matcher so the word
// "fire" alone can never hijack these questions.
// -----------------------------------------------------
const ALL_TYPES = [
    "normal", "fire", "water", "electric", "grass", "ice",
    "fighting", "poison", "ground", "flying", "psychic", "bug",
    "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

// (Effectiveness signals now live per-question in EFFECTIVENESS_QUESTIONS.)

// Vietnamese type names (normalized) -> English type
const TYPE_ALIASES = [
    ["lua", "fire"],
    ["nuoc", "water"],
    ["co", "grass"],
    ["dien", "electric"],
    ["bang", "ice"],
    ["giac dau", "fighting"],
    ["doc", "poison"],
    ["dat", "ground"],
    ["bay", "flying"],
    ["tam linh", "psychic"],
    ["sau", "bug"],
    ["bo", "bug"],
    ["da", "rock"],
    ["ma", "ghost"],
    ["rong", "dragon"],
    ["bong toi", "dark"],
    ["thep", "steel"],
    ["tien", "fairy"],
];

// Extract a type name from normalized text (English or Vietnamese).
function extractType(normText) {
    const padded = ` ${normText} `;

    for (const t of ALL_TYPES) {
        if (padded.includes(` ${t} `)) {
            return t;
        }
    }

    for (const [alias, t] of TYPE_ALIASES) {
        if (padded.includes(` ${alias} `)) {
            return t;
        }
    }

    if (padded.includes(" fight ")) {
        return "fighting";
    }

    return null;
}

// Extract an explicit damage multiplier from the RAW text
// ("x2", "2x", "x4", "x1", "1x", "x1/2", "1/2x", "x0.5", "0.5x").
// Must run on the raw text because normalizeText turns "x1/2"
// into "x1 2", losing the fraction. Returns null when absent.
function extractMultiplier(rawText) {
    const t = String(rawText || "").toLowerCase();

    // Fractions / decimals (0.5x) — check BEFORE plain "x1"
    if (/\bx\s*1\s*\/\s*2\b/.test(t) || /\b1\s*\/\s*2\s*x\b/.test(t)) {
        return 0.5;
    }

    if (/\bx\s*0\.5\b/.test(t) || /\b0\.5\s*x\b/.test(t)) {
        return 0.5;
    }

    if (/\bx\s*4\b/.test(t) || /\b4\s*x\b/.test(t)) {
        return 4;
    }

    if (/\bx\s*2\b/.test(t) || /\b2\s*x\b/.test(t)) {
        return 2;
    }

    if (/\bx\s*1\b/.test(t) || /\b1\s*x\b/.test(t)) {
        return 1;
    }

    return null;
}

// Phase 1: detect "<effect> <type>" style questions, e.g.
// "weak to fire", "does it resist fire?", "immune to electric",
// "does fire do normal damage to it?", "x1/2 with fire".
// Returns { key, value } or null (not an effectiveness question).
function interpretEffectiveness(normText, rawText) {
    const padded = ` ${normText} `;

    // Strongest signal first: an explicit multiplier.
    // "x1/2" = 0.5x = resists (NOT "x1" = normal damage).
    const mult = extractMultiplier(rawText);

    if (mult !== null) {
        const key =
            mult >= 2 ? "weak_to" : mult === 1 ? "normal_vs" : "resists";
        const type = extractType(normText);

        if (!type) {
            return {
                key,
                value: null,
                missingValue: true,
                valueKind: "type",
            };
        }

        return { key, value: type };
    }

    for (const eq of EFFECTIVENESS_QUESTIONS) {
        const signal = eq.signals.find((kw) =>
            padded.includes(` ${kw} `)
        );

        if (!signal) {
            continue;
        }

        // Strip the signal phrase before extracting the type, so effect
        // vocabulary can't be mistaken for the type name
        // ("is fire normal against it?" -> type "fire", not "normal").
        const rest = padded.replace(` ${signal} `, " ");
        const type = extractType(rest);

        if (!type) {
            return {
                key: eq.key,
                value: null,
                missingValue: true,
                valueKind: "type",
            };
        }

        return { key: eq.key, value: type };
    }

    return null;
}

// Understand a free-text question -> { key, value } or null (not understood)
function interpretQuestion(questionText) {
    // Dash range ("gen 1-5", "gen 1 - 5"): detect on the RAW text
    // because normalizeText strips dashes into spaces.
    const dashRange = String(questionText || "").match(
        /\b([1-9])\s*-\s*([1-9])\b/
    );

    if (dashRange) {
        const rawNorm = normalizeText(questionText);
        const padded = ` ${rawNorm} `;

        if (
            padded.includes(" gen ") ||
            padded.includes(" generation ") ||
            padded.includes(" the he ")
        ) {
            const a = Number(dashRange[1]);
            const b = Number(dashRange[2]);

            return {
                key: "generation_range",
                value: { from: Math.min(a, b), to: Math.max(a, b) },
            };
        }
    }

    const norm = normalizeText(questionText);

    if (!norm) {
        return null;
    }

    // Phase 1: type-effectiveness questions ("x2 with fire",
    // "weak to fire", "super effective with fire", "x1/2 with fire"...).
    // Must run before the generic matcher so the bare word
    // "fire" can never hijack them into "Is it a Fire type?".
    const eff = interpretEffectiveness(norm, questionText);

    if (eff) {
        return eff;
    }

    // Phase 2: generic keyword matcher
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

    // Generation-range override: "from gen 2 to 5" / "từ gen 2 đến 5"
    // always wins over an exact-generation match, no matter which
    // keyword won the generic matcher above.
    if (
        best.def.key === "generation" ||
        best.def.key === "generation_range"
    ) {
        const range = extractGenerationRange(norm);

        if (range) {
            return { key: "generation_range", value: range };
        }
    }

    let value = null;

    if (best.def.needsValue) {
        if (best.def.valueKind === "type") {
            value = extractType(norm);

            if (!value) {
                return {
                    key: best.def.key,
                    value: null,
                    missingValue: true,
                    valueKind: "type",
                };
            }
        } else if (best.def.valueKind === "genRange") {
            // Only reachable when the range override found no 2nd number,
            // e.g. "from gen 3" -> treat as an exact generation question.
            const g = extractGeneration(norm);

            if (g === null) {
                return {
                    key: best.def.key,
                    value: null,
                    missingValue: true,
                    valueKind: "genRange",
                };
            }

            return { key: "generation", value: g };
        } else {
            value = extractGeneration(norm);

            if (value === null) {
                // Understood as a generation question but missing the number -> not enough to answer
                return { key: best.def.key, value: null, missingValue: true };
            }
        }
    }

    return { key: best.def.key, value };
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

// -----------------------------------------------------
// AUTO-NARROW CANDIDATES FROM Q&A ANSWERS
//
// Every Yes/No answer is also a deduction: the candidate list
// shrinks automatically so the player sees the remaining
// possibilities narrow down in real time.
// -----------------------------------------------------
// A Yes/No answer IS a deduction: reuse the question's own check()
// so every current and future definition narrows candidates
// automatically (types, dual, generation, range, legendary,
// effectiveness, starter, ...).
function deductionMatches(pokemon, h) {
    const def = getDefinition(h.key);

    if (!def) {
        return true;
    }

    try {
        const matches = !!def.check(pokemon, h.questionValue);
        return h.answer ? matches : !matches;
    } catch {
        // Never let a bad deduction wipe the candidate list
        return true;
    }
}

// Recompute candidates = manual filters (FilterPanel) + deductions
// from every answered question.
async function recomputeCandidates(game) {
    const base = await pokemonFilterService.filterPokemon(
        game.filters || {}
    );
    const history = game.questionsAsked || [];
    game.candidates = base.filter((p) =>
        history.every((h) => deductionMatches(p, h))
    );
}

// Manual filter change from the client (FilterPanel).
async function applySoloFilter(playerId, filters) {
    const game = getGameOrThrow(playerId);

    if (!filters || typeof filters !== "object") {
        throw new Error("Invalid filters");
    }

    const updated = { ...game.filters };

    for (const key of VALID_SOLO_FILTER_KEYS) {
        if (key in filters) {
            updated[key] = filters[key];
        }
    }

    game.filters = updated;
    await recomputeCandidates(game);

    return getPublicState(playerId);
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
        wrongGuessIds: [], // ids of Pokémon guessed wrong (greyed out in the list)
        filters: { ...DEFAULT_SOLO_FILTERS },
        candidates: [...pokemonMetadataCache.getAll()], // full list until narrowed
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
                "weakness (\"weak to fire\"), generation (\"gen 3\", \"gen 1-5\", \"from gen 2 to 5\"), " +
                "starter, evolution, legendary... or click a suggestion below.",
        };
    }

    if (interpreted.missingValue) {
        const message =
            interpreted.valueKind === "type"
                ? "Which type do you mean? Example: \"Is it weak to fire?\""
                : interpreted.valueKind === "genRange"
                  ? "Which generations? Example: \"Is it from generation 2 to 5?\""
                  : "Which generation do you want to ask about? Example: \"Is this Pokémon from generation 3?\"";

        return { understood: false, message };
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

// Build the display label for a question, substituting its value.
// valueKind "genRange" uses { from, to } instead of a single {value}.
function formatLabel(def, value) {
    if (def.key === "generation_range" && value) {
        return `Is it from generation ${value.from} to ${value.to}?`;
    }

    if (def.needsValue) {
        return def.label.replace("{value}", String(value));
    }

    return def.label;
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

    const label = formatLabel(def, questionValue);

    game.questionsAsked.push({
        key: def.key,
        label,
        questionText: questionText || null, // the player's original typed question
        questionValue: questionValue ?? null,
        answer,
    });
    game.questionsCount += 1;

    // ⭐ The answer is also a deduction: narrow the candidate list
    await recomputeCandidates(game);

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

    // Wrong guess: the game continues, but points are deducted.
    // Remember WHICH Pokémon was guessed so the client can grey it out.
    game.wrongGuesses += 1;

    const guessed = pokemonMetadataCache
        .getAll()
        .find(
            (p) =>
                normalizeName(p.name) === input || String(p.id) === input
        );

    if (guessed && !game.wrongGuessIds.includes(guessed.id)) {
        game.wrongGuessIds.push(guessed.id);
    }

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
        wrongGuessIds: game.wrongGuessIds || [],
        filters: game.filters || { ...DEFAULT_SOLO_FILTERS },
        // Slim candidates for the card list (full metadata stays server-side)
        candidates: (game.candidates || []).map((p) => ({
            id: p.id,
            name: p.name,
            sprite: p.sprite || null,
            types: p.types || [],
        })),
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
    DEFAULT_SOLO_FILTERS,
    startSoloGame,
    askQuestion,
    askFreeText,
    applySoloFilter,
    interpretQuestion,
    normalizeText,
    guessPokemon,
    giveUp,
    getPublicState,
    endGame,
    calculateScore,
};