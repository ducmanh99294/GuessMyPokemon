const { MongoClient } = require("mongodb");

let client = null;
let db = null;
let ready = false;

async function connectMongo() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.log(
            "[mongo] MONGODB_URI chưa được set — dùng lưu trữ file JSON local."
        );
        return null;
    }

    client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db(); // database name từ URI

    // Index: email unique (chống trùng tài khoản),
    // leaderboard sort theo score và lọc theo playerId.
    await db
        .collection("users")
        .createIndex({ email: 1 }, { unique: true });
    await db.collection("leaderboard").createIndex({ score: -1 });
    await db
        .collection("leaderboard")
        .createIndex({ playerId: 1, score: -1 });

    // Index: pokemons — id unique + các trường hay dùng để lọc.
    // Thêm field mới cần lọc sau này -> thêm createIndex tương ứng ở đây.
    await db
        .collection("pokemons")
        .createIndex({ id: 1 }, { unique: true });
    await db.collection("pokemons").createIndex({ name: 1 });
    await db.collection("pokemons").createIndex({ types: 1 });
    await db.collection("pokemons").createIndex({ generation: 1 });

    ready = true;
    console.log("[mongo] Đã kết nối MongoDB.");
    return db;
}

function getDb() {
    if (!ready || !db) {
        throw new Error("MongoDB chưa kết nối.");
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