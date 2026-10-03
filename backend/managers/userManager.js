// =====================================================
// UserManager - quản lý tài khoản (đăng ký / đăng nhập)
//
// Backend lưu trữ kép:
// - Nếu MongoDB đã kết nối (MONGODB_URI): dùng collection "users".
// - Nếu chưa: fallback về file JSON local
//   backend/data/users.json (dev không cần cài gì thêm).
//
// Tất cả hàm public đều async để 2 backend dùng chung interface.
// - Mật khẩu hash bằng bcrypt (không bao giờ lưu plaintext).
// - Mỗi email chỉ đăng ký 1 lần (so sánh không phân biệt hoa/thường).
// =====================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const mongo = require("../db/mongo");

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_DATA_FILE = path.join(DATA_DIR, "users.json");
const DATA_FILE = process.env.USERS_FILE || DEFAULT_DATA_FILE;

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const MAX_NAME_LENGTH = 20;

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

function readUsersJson() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("[userManager] read failed:", error.message);
        return [];
    }
}

function writeUsersJson(users) {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
    } catch (error) {
        console.error("[userManager] write failed:", error.message);
        throw new Error("Không thể lưu dữ liệu người dùng.");
    }
}

// ---------------- Helpers chung ----------------

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

// Public shape: không bao giờ trả passwordHash ra ngoài.
// Hỗ trợ cả doc Mongo (_id) và object JSON (id).
function toPublicUser(user) {
    if (!user) return null;
    return {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
    };
}

function validateRegisterInput({ name, email, password }) {
    const cleanName = String(name || "").trim();
    const cleanEmail = normalizeEmail(email);

    if (cleanName.length < 2) {
        throw new Error("Tên hiển thị phải có ít nhất 2 ký tự.");
    }
    if (cleanName.length > MAX_NAME_LENGTH) {
        throw new Error(`Tên hiển thị tối đa ${MAX_NAME_LENGTH} ký tự.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error("Email không hợp lệ.");
    }
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
    }

    return { name: cleanName, email: cleanEmail, password: String(password) };
}

// ---------------- Public API (async) ----------------

async function findByEmail(email) {
    const normalized = normalizeEmail(email);

    if (mongo.isMongoReady()) {
        return mongo.getDb().collection("users").findOne({ email: normalized });
    }

    return readUsersJson().find((u) => u.email === normalized) || null;
}

async function findById(id) {
    if (!id) return null;

    if (mongo.isMongoReady()) {
        // _id lưu dạng string uuid nên query trực tiếp bằng string
        return mongo.getDb().collection("users").findOne({ _id: String(id) });
    }

    return readUsersJson().find((u) => u.id === id) || null;
}

async function createUser({ name, email, password }) {
    const input = validateRegisterInput({ name, email, password });

    if (await findByEmail(input.email)) {
        throw new Error("Email này đã được đăng ký.");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const doc = {
        _id: crypto.randomUUID(), // string uuid, query trực tiếp không cần ObjectId
        name: input.name,
        email: input.email,
        passwordHash,
        createdAt: new Date().toISOString(),
    };

    if (mongo.isMongoReady()) {
        try {
            await mongo.getDb().collection("users").insertOne(doc);
        } catch (error) {
            // Phòng trường hợp race condition trùng email
            if (error.code === 11000) {
                throw new Error("Email này đã được đăng ký.");
            }
            throw error;
        }
        return toPublicUser(doc);
    }

    const users = readUsersJson();
    // Chuẩn hoá object JSON: dùng field "id" như cũ
    const jsonUser = {
        id: doc._id,
        name: doc.name,
        email: doc.email,
        passwordHash: doc.passwordHash,
        createdAt: doc.createdAt,
    };
    users.push(jsonUser);
    writeUsersJson(users);

    return toPublicUser(jsonUser);
}

async function verifyPassword(user, password) {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(String(password || ""), user.passwordHash);
}

module.exports = {
    MIN_PASSWORD_LENGTH,
    MAX_NAME_LENGTH,
    DATA_FILE,
    createUser,
    findByEmail,
    findById,
    verifyPassword,
    toPublicUser,
    validateRegisterInput,
};