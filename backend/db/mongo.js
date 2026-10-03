// =====================================================
// MongoDB connection (native driver, không dùng ODM)
//
// Cách dùng trong app.js (trước app.listen):
//   const { connectMongo } = require("./db/mongo");
//   await connectMongo(); // không throw nếu chưa có MONGODB_URI
//
// - Nếu có MONGODB_URI: kết nối, tạo index, các manager
//   (userManager, soloLeaderboard) sẽ dùng MongoDB.
// - Nếu không có: in log và các manager tự fallback về
//   file JSON local (chạy dev không cần cài gì thêm).
//
// Tên database lấy từ chính URI
// (vd: ...mongodb.net/ten_db?... -> dùng "ten_db").
// =====================================================

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