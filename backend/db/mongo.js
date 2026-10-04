// =====================================================
// MongoDB connection (native driver, no ODM)
//
// Usage in app.js (before app.listen):
//   const { connectMongo } = require("./db/mongo");
//   await connectMongo(); // never throws when MONGODB_URI is missing
//
// - With MONGODB_URI: connect, create indexes, and the managers
//   (userManager, soloLeaderboard) will use MongoDB.
// - Without it: log a message and the managers fall back to
//   local JSON files (no setup needed for dev).
//
// The database name comes from the URI itself
// (e.g. ...mongodb.net/my_db?... -> uses "my_db").
// =====================================================

const { MongoClient } = require("mongodb");

let client = null;
let db = null;
let ready = false;

async function connectMongo() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.log(
            "[mongo] MONGODB_URI is not set — using local JSON file storage."
        );
        return null;
    }

    client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db(); // database name from the URI

    // Index: unique email (prevents duplicate accounts).
    await db
        .collection("users")
        .createIndex({ email: 1 }, { unique: true });

    // Index: leaderboard split by mode (daily/pvp).
    await db
        .collection("leaderboard")
        .createIndex({ mode: 1, score: -1 });
    await db
        .collection("leaderboard")
        .createIndex({ mode: 1, playerId: 1, score: -1 });
    // Index: daily upsert lookup (one entry per player per day).
    await db
        .collection("leaderboard")
        .createIndex({ mode: 1, ownerId: 1, dailyKey: 1 });

    // Collection: one-challenge-per-day tracking.
    // Unique key per player per day; old records expire via TTL.
    await db.collection("daily_plays").createIndex({ key: 1 }, { unique: true });
    await db
        .collection("daily_plays")
        .createIndex({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 3600 });

    // Clean up old indexes (from before the mode split) if any remain.
    for (const oldIndex of [{ score: -1 }, { playerId: 1, score: -1 }]) {
        try {
            await db.collection("leaderboard").dropIndex(oldIndex);
        } catch (error) {
            // index doesn't exist -> skip
        }
    }

    // One-time backfill (idempotent): old entries without a mode -> "daily".
    await db
        .collection("leaderboard")
        .updateMany({ mode: { $exists: false } }, { $set: { mode: "daily" } });

    // One-time backfill (idempotent): legacy "solo" mode -> "daily".
    await db
        .collection("leaderboard")
        .updateMany({ mode: "solo" }, { $set: { mode: "daily" } });

    // Index: pokemons — unique id + commonly filtered fields.
    // To filter by a new field later -> add the matching createIndex here.
    await db
        .collection("pokemons")
        .createIndex({ id: 1 }, { unique: true });
    await db.collection("pokemons").createIndex({ name: 1 });
    await db.collection("pokemons").createIndex({ types: 1 });
    await db.collection("pokemons").createIndex({ generation: 1 });

    ready = true;
    console.log("[mongo] Connected to MongoDB.");
    return db;
}

function getDb() {
    if (!ready || !db) {
        throw new Error("MongoDB is not connected.");
    }
    return db;
}

function isMongoReady() {
    return ready;
}

async function closeMongo() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        ready = false;
    }
}

module.exports = {
    connectMongo,
    getDb,
    isMongoReady,
    closeMongo,
};
