// =====================================================
// SoloLeaderboard - bảng xếp hạng solo mode (persistent)
//
// Backend lưu trữ kép:
// - Nếu MongoDB đã kết nối (MONGODB_URI): dùng collection
//   "leaderboard" (đã tạo index theo score ở db/mongo.js).
// - Nếu chưa: fallback về file JSON local
//   backend/data/solo_leaderboard.json.
//   Có thể override đường dẫn bằng env SOLO_LEADERBOARD_FILE
//   (hữu ích cho test).
//
// Mỗi khi game solo kết thúc (won / lost / gaveup) thì ghi
// 1 entry. Entry của game đã kết thúc nên chứa secretName
// là an toàn (đáp án đã được reveal cho người chơi).
//
// Tất cả hàm public đều async để 2 backend dùng chung interface.
// Không dùng dependency ngoài: id tạo bằng
// crypto.randomUUID() có sẵn của Node.
// =====================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongo = require("../db/mongo");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_DATA_FILE = path.join(DATA_DIR, "solo_leaderboard.json");
const DATA_FILE = process.env.SOLO_LEADERBOARD_FILE || DEFAULT_DATA_FILE;
const MAX_ENTRIES = 500; // chỉ áp dụng cho backend JSON

// ---------------- JSON fallback ----------------

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, "[]", "utf8");
    }
}

function readEntries() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("[soloLeaderboard] read failed:", error.message);
        return [];
    }
}

function writeEntries(entries) {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
    } catch (error) {
        console.error("[soloLeaderboard] write failed:", error.message);
    }
}

function sortByScore(entries) {
    return entries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

// Chuẩn hoá doc Mongo (_id) về shape chung (id)
function fromDoc(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
}

function buildEntry({
    playerId,
    playerName,
    score,
    questionsUsed,
    wrongGuesses,
    won,
    secretName,
    secretId,
    durationSeconds,
}) {
    return {
        _id: crypto.randomUUID(),
        playerId: playerId || "unknown",
        playerName: (playerName || "").trim() || "Người chơi ẩn danh",
        score: Number(score) || 0,
        questionsUsed: Number(questionsUsed) || 0,
        wrongGuesses: Number(wrongGuesses) || 0,
        won: !!won,
        secretName: secretName || null,
        secretId: secretId ?? null,
        durationSeconds: Number(durationSeconds) || 0,
        createdAt: new Date().toISOString(),
    };
}

// ---------------- Public API (async) ----------------

// Ghi 1 entry khi game kết thúc.
// Lưu cả game thua / bỏ cuộc (score = 0) để thống kê.
async function addEntry(data) {
    const doc = buildEntry(data);

    if (mongo.isMongoReady()) {
        await mongo.getDb().collection("leaderboard").insertOne(doc);
        return fromDoc(doc);
    }

    const entry = fromDoc(doc);
    const entries = readEntries();
    entries.push(entry);

    // JSON backend: giữ tối đa MAX_ENTRIES entry điểm cao nhất
    const trimmed = sortByScore(entries).slice(0, MAX_ENTRIES);
    writeEntries(trimmed);

    return entry;
}

async function getTop(limit = 10) {
    const n = Math.max(1, Number(limit) || 10);

    if (mongo.isMongoReady()) {
        const docs = await mongo
            .getDb()
            .collection("leaderboard")
            .find({})
            .sort({ score: -1, createdAt: -1 })
            .limit(n)
            .toArray();
        return docs.map(fromDoc);
    }

    return sortByScore(readEntries()).slice(0, n);
}

async function getRecent(limit = 10) {
    const n = Math.max(1, Number(limit) || 10);

    if (mongo.isMongoReady()) {
        const docs = await mongo
            .getDb()
            .collection("leaderboard")
            .find({})
            .sort({ createdAt: -1 })
            .limit(n)
            .toArray();
        return docs.map(fromDoc);
    }

    return readEntries()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, n);
}

// Thành tích tốt nhất của 1 người chơi + thống kê tổng quan
async function getPlayerBest(playerId) {
    if (!playerId) return null;

    if (mongo.isMongoReady()) {
        const col = mongo.getDb().collection("leaderboard");

        const [bestDoc, totalGames, wins] = await Promise.all([
            col
                .find({ playerId })
                .sort({ score: -1, createdAt: -1 })
                .limit(1)
                .toArray()
                .then((docs) => docs[0] || null),
            col.countDocuments({ playerId }),
            col.countDocuments({ playerId, won: true }),
        ]);

        if (!bestDoc) return null;

        return {
            best: fromDoc(bestDoc),
            totalGames,
            wins,
            bestScore: bestDoc.score,
        };
    }

    const mine = readEntries().filter((e) => e.playerId === playerId);

    if (mine.length === 0) return null;

    const best = sortByScore([...mine])[0];

    return {
        best,
        totalGames: mine.length,
        wins: mine.filter((e) => e.won).length,
        bestScore: best.score,
    };
}

async function clearAll() {
    if (mongo.isMongoReady()) {
        await mongo.getDb().collection("leaderboard").deleteMany({});
        return;
    }

    writeEntries([]);
}

module.exports = {
    MAX_ENTRIES,
    DATA_FILE,
    addEntry,
    getTop,
    getRecent,
    getPlayerBest,
    clearAll,
};