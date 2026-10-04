// =====================================================
// UserManager - account management (register / login)
//
// Dual storage backend:
// - If MongoDB is connected (MONGODB_URI): use the "users" collection.
// - Otherwise: fall back to the local JSON file
//   backend/data/users.json (no setup needed for dev).
//
// All public functions are async so both backends share one interface.
// - Passwords hashed with bcrypt (never stored in plaintext).
// - Each email can register once (case-insensitive comparison).
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
        throw new Error("Could not save user data.");
    }
}

// ---------------- Helpers chung ----------------

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

// Public shape: never expose passwordHash.
// Supports both Mongo docs (_id) and JSON objects (id).
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
        throw new Error("Display name must be at least 2 characters.");
    }
    if (cleanName.length > MAX_NAME_LENGTH) {
        throw new Error(`Display name must be at most ${MAX_NAME_LENGTH} characters.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error("Invalid email.");
    }
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
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
        // _id is stored as a string uuid, so query directly with a string
        return mongo.getDb().collection("users").findOne({ _id: String(id) });
    }

    return readUsersJson().find((u) => u.id === id) || null;
}

async function createUser({ name, email, password }) {
    const input = validateRegisterInput({ name, email, password });

    if (await findByEmail(input.email)) {
        throw new Error("This email is already registered.");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const doc = {
        _id: crypto.randomUUID(), // string uuid, query directly without ObjectId
        name: input.name,
        email: input.email,
        passwordHash,
        createdAt: new Date().toISOString(),
    };

    if (mongo.isMongoReady()) {
        try {
            await mongo.getDb().collection("users").insertOne(doc);
        } catch (error) {
            // Guard against email race conditions
            if (error.code === 11000) {
                throw new Error("This email is already registered.");
            }
            throw error;
        }
        return toPublicUser(doc);
    }

    const users = readUsersJson();
    // Normalize the JSON object: use the "id" field as before
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
