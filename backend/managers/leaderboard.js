// =====================================================
// Leaderboard - leaderboard by game mode
//
// mode = "daily" (daily challenge) | "pvp" (battle other players)
// ("solo" is the legacy name for "daily" and is mapped automatically.)
//
// Dual storage backend:
// - If MongoDB is connected (MONGODB_URI): use the
//   "leaderboard" collection (each entry has a `mode` field; the
//   { mode, score } index is created in db/mongo.js).
// - Otherwise: fall back to the local JSON file
//   backend/data/leaderboard.json (distinguished by `mode`).
//   Old solo data in solo_leaderboard.json is migrated
//   automatically once.
//
// All public functions are async so both backends share one interface.
// No external dependencies: ids are created with
// Node's built-in crypto.randomUUID().
// =====================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongo = require("../db/mongo");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_DATA_FILE = path.join(DATA_DIR, "leaderboard.json");
const LEGACY_DATA_FILE = path.join(DATA_DIR, "solo_leaderboard.json");
const DATA_FILE =
    process.env.LEADERBOARD_FILE ||
    process.env.SOLO_LEADERBOARD_FILE ||
    DEFAULT_DATA_FILE;
const MAX_ENTRIES = 500; // per mode, only applies to the JSON backend

const MODES = ["daily", "pvp"];

// Legacy "solo" entries are treated as "daily".
function normalizeMode(mode) {
    if (mode === "solo") return "daily";
    return MODES.includes(mode) ? mode : "daily";
}

// Calendar-day key, e.g. "2026-10-4" (server local time).
// Daily-challenge entries are bucketed per day so the leaderboard
// resets every day.
function dailyKey(date = new Date()) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// ---------------- JSON fallback ----------------

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        // One-time migration: old solo data -> new file
        if (fs.existsSync(LEGACY_DATA_FILE)) {
            try {
                const raw = fs.readFileSync(LEGACY_DATA_FILE, "utf8");
                const parsed = JSON.parse(raw);
                const migrated = (Array.isArray(parsed) ? parsed : []).map(
                    (entry) => ({ mode: "daily", ...entry })
                );

                fs.writeFileSync(
                    DATA_FILE,
                    JSON.stringify(migrated, null, 2),
                    "utf8"
                );

                console.log(
                    `[leaderboard] Migrated ${migrated.length} old solo entries.`
                );
                return;
            } catch (error) {
                console.error(
                    "[leaderboard] migrate legacy file failed:",
                    error.message
                );
            }
        }

        fs.writeFileSync(DATA_FILE, "[]", "utf8");
    }
}

function readEntries() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        // Old entries without a mode -> treated as daily.
        // Legacy "solo" mode -> "daily".
        return parsed.map((entry) => ({
            ...entry,
            mode: !entry.mode || entry.mode === "solo" ? "daily" : entry.mode,
        }));
    } catch (error) {
        console.error("[leaderboard] read failed:", error.message);
        return [];
    }
}

function writeEntries(entries) {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
    } catch (error) {
        console.error("[leaderboard] write failed:", error.message);
    }
}

function sortByScore(entries) {
    return entries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

// Normalize Mongo docs (_id) to the common shape (id)
function fromDoc(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
}

function buildEntry({
    mode = "daily",
    playerId,
    ownerId, // verified user id (daily, logged-in players only)
    playerName,
    dailyKey: key, // day bucket for the daily leaderboard
    score,
    questionsUsed, // daily: questions used
    wrongGuesses, // daily: wrong guesses
    guesses, // pvp: total guesses
    cluesUsed, // pvp: clues used
    won,
    secretName, // daily: the answer (revealed)
    secretId, // daily
    opponentName, // pvp: opponent name
    durationSeconds,
}) {
    return {
        _id: crypto.randomUUID(),
        mode: normalizeMode(mode),
        playerId: playerId || "unknown",
        ownerId: ownerId || null,
        playerName: (playerName || "").trim() || "Anonymous player",
        dailyKey: key || dailyKey(),
        score: Number(score) || 0,
        questionsUsed: Number(questionsUsed) || 0,
        wrongGuesses: Number(wrongGuesses) || 0,
        guesses: Number(guesses) || 0,
        cluesUsed: Number(cluesUsed) || 0,
        won: !!won,
        secretName: secretName || null,
        secretId: secretId ?? null,
        opponentName: opponentName || null,
        durationSeconds: Number(durationSeconds) || 0,
        createdAt: new Date().toISOString(),
    };
}

// ---------------- Public API (async) ----------------

// Write 1 entry when a game ends.
//
// ANTI-CHEAT (daily mode): one entry per player per day — if the
// player already has an entry for today (matched by verified ownerId),
// only the HIGHER score is kept. This stops leaderboard spam from
// replaying and makes multi-account farming pointless (each game
// hides a random Pokémon anyway).
async function addEntry(data) {
    const doc = buildEntry(data || {});
    const m = doc.mode;

    if (m === "daily" && doc.ownerId) {
        return upsertDailyEntry(doc);
    }

    if (mongo.isMongoReady()) {
        await mongo.getDb().collection("leaderboard").insertOne(doc);
        return fromDoc(doc);
    }

    const entry = fromDoc(doc);
    const entries = readEntries();
    entries.push(entry);

    // JSON backend: each mode keeps at most MAX_ENTRIES top entries
    const byMode = entries.filter((e) => e.mode === entry.mode);
    const others = entries.filter((e) => e.mode !== entry.mode);
    const trimmed = sortByScore(byMode).slice(0, MAX_ENTRIES);
    writeEntries([...others, ...trimmed]);

    return entry;
}

// Upsert: keep the best score of the day for this player.
async function upsertDailyEntry(doc) {
    const filter = {
        mode: "daily",
        ownerId: doc.ownerId,
        dailyKey: doc.dailyKey,
    };

    if (mongo.isMongoReady()) {
        const col = mongo.getDb().collection("leaderboard");
        const existing = await col.findOne(filter);

        if (!existing) {
            await col.insertOne(doc);
            return fromDoc(doc);
        }

        // Keep the higher score (tie -> fewer questions wins the detail row)
        if (
            doc.score > existing.score ||
            (doc.score === existing.score &&
                doc.questionsUsed < existing.questionsUsed)
        ) {
            const { _id, ...rest } = doc;
            await col.updateOne(
                { _id: existing._id },
                { $set: { ...rest, updatedAt: new Date().toISOString() } }
            );
            return fromDoc({ _id: existing._id, ...rest });
        }

        return fromDoc(existing);
    }

    // JSON fallback
    const entries = readEntries();
    const idx = entries.findIndex(
        (e) =>
            e.mode === "daily" &&
            e.ownerId === doc.ownerId &&
            e.dailyKey === doc.dailyKey
    );

    if (idx === -1) {
        const entry = fromDoc(doc);
        entries.push(entry);
        writeEntries(entries);
        return entry;
    }

    const existing = entries[idx];
    if (
        doc.score > existing.score ||
        (doc.score === existing.score &&
            doc.questionsUsed < (existing.questionsUsed || 0))
    ) {
        const updated = { ...fromDoc(doc), id: existing.id };
        entries[idx] = updated;
        writeEntries(entries);
        return updated;
    }

    return existing;
}

async function getTop(limit = 10, mode = "daily") {
    const n = Math.max(1, Number(limit) || 10);
    const m = normalizeMode(mode);

    if (mongo.isMongoReady()) {
        const docs = await mongo
            .getDb()
            .collection("leaderboard")
            .find({ mode: m })
            .sort({ score: -1, createdAt: -1 })
            .limit(n)
            .toArray();
        return docs.map(fromDoc);
    }

    return sortByScore(readEntries().filter((e) => e.mode === m)).slice(0, n);
}

async function getRecent(limit = 10, mode = "daily") {
    const n = Math.max(1, Number(limit) || 10);
    const m = normalizeMode(mode);

    if (mongo.isMongoReady()) {
        const docs = await mongo
            .getDb()
            .collection("leaderboard")
            .find({ mode: m })
            .sort({ createdAt: -1 })
            .limit(n)
            .toArray();
        return docs.map(fromDoc);
    }

    return readEntries()
        .filter((e) => e.mode === m)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, n);
}

// Best achievement of 1 player + overall stats (per mode)
async function getPlayerBest(playerId, mode = "daily") {
    if (!playerId) return null;

    const m = normalizeMode(mode);

    if (mongo.isMongoReady()) {
        const col = mongo.getDb().collection("leaderboard");

        const [bestDoc, totalGames, wins] = await Promise.all([
            col
                .find({ playerId, mode: m })
                .sort({ score: -1, createdAt: -1 })
                .limit(1)
                .toArray()
                .then((docs) => docs[0] || null),
            col.countDocuments({ playerId, mode: m }),
            col.countDocuments({ playerId, mode: m, won: true }),
        ]);

        if (!bestDoc) return null;

        return {
            best: fromDoc(bestDoc),
            totalGames,
            wins,
            bestScore: bestDoc.score,
        };
    }

    const mine = readEntries().filter(
        (e) => e.playerId === playerId && e.mode === m
    );

    if (mine.length === 0) return null;

    const best = sortByScore([...mine])[0];

    return {
        best,
        totalGames: mine.length,
        wins: mine.filter((e) => e.won).length,
        bestScore: best.score,
    };
}

async function clearAll(mode = "daily") {
    const m = normalizeMode(mode);

    if (mongo.isMongoReady()) {
        await mongo.getDb().collection("leaderboard").deleteMany({ mode: m });
        return;
    }

    writeEntries(readEntries().filter((e) => e.mode !== m));
}

module.exports = {
    MODES,
    MAX_ENTRIES,
    DATA_FILE,
    normalizeMode,
    addEntry,
    getTop,
    getRecent,
    getPlayerBest,
    clearAll,
};
