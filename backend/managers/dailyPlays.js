// =====================================================
// dailyPlays - one challenge per day tracking
//
// Records when a player FINISHES a daily-challenge game
// (won / lost / gave up). Starting a new game is blocked if
// the player already finished one today.
//
// Identity:
// - Logged-in players: verified user id  -> key "u:<ownerId>:<dailyKey>"
//   (works across browsers/devices; cannot be spoofed because the
//   ownerId comes from the verified JWT, not the client).
// - Guests: browser-generated playerId -> key "g:<playerId>:<dailyKey>"
//   (stops casual replay; bypassable by clearing site data or
//   incognito — accepted tradeoff, guest scores aren't recorded
//   anyway so there is nothing competitive to gain).
//
// Storage: MongoDB collection "daily_plays" when available,
// otherwise an in-memory Map (lost on server restart).
// Old records expire automatically via a TTL index (Mongo) or
// lazy pruning (memory).
// =====================================================

const mongo = require("../db/mongo");

const COLLECTION = "daily_plays";
const TTL_SECONDS = 3 * 24 * 3600; // keep 3 days of history

// In-memory fallback: key -> timestamp (ms)
const memoryPlays = new Map();

// Calendar-day key, e.g. "2026-10-4" (server local time).
function todayKey(date = new Date()) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Build the storage key for a player.
// Accepts { isGuest, ownerId, playerId }.
function makeKey({ isGuest, ownerId, playerId }) {
    const id = isGuest ? `g:${playerId}` : `u:${ownerId}`;
    return `${id}:${todayKey()}`;
}

function pruneMemory() {
    const cutoff = Date.now() - TTL_SECONDS * 1000;
    for (const [key, ts] of memoryPlays) {
        if (ts < cutoff) memoryPlays.delete(key);
    }
}

// Has this player already finished today's challenge?
async function hasPlayedToday(identity) {
    if (!identity || (!identity.playerId && !identity.ownerId)) {
        return false;
    }

    const key = makeKey(identity);

    if (mongo.isMongoReady()) {
        const doc = await mongo
            .getDb()
            .collection(COLLECTION)
            .findOne({ key });
        return !!doc;
    }

    pruneMemory();
    return memoryPlays.has(key);
}

// Record that this player finished today's challenge.
// Idempotent: calling twice for the same day is harmless.
async function recordPlayed(identity) {
    if (!identity || (!identity.playerId && !identity.ownerId)) {
        return;
    }

    const key = makeKey(identity);
    const now = new Date();

    if (mongo.isMongoReady()) {
        await mongo.getDb().collection(COLLECTION).updateOne(
            { key },
            {
                $setOnInsert: {
                    key,
                    dailyKey: todayKey(),
                    isGuest: !!identity.isGuest,
                    createdAt: now,
                },
                $set: { updatedAt: now },
            },
            { upsert: true }
        );
        return;
    }

    pruneMemory();
    memoryPlays.set(key, Date.now());
}

module.exports = {
    todayKey,
    makeKey,
    hasPlayedToday,
    recordPlayed,
};
