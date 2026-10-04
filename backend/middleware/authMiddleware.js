// =====================================================
// JWT helpers + auth middleware
//
// - Tokens are signed with JWT_SECRET (env), expiring after 7 days.
// - The client sends: Authorization: Bearer <token>
// - The middleware attaches req.user (public shape, no passwordHash).
// =====================================================

const jwt = require("jsonwebtoken");
const userManager = require("../managers/userManager");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const JWT_EXPIRES_IN = "7d";

if (!process.env.JWT_SECRET) {
    console.warn(
        "[auth] JWT_SECRET is not set — using the default secret, " +
            "only suitable for dev environments."
    );
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

// Middleware: login required
async function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "You need to log in.",
        });
    }

    let payload;
    try {
        payload = verifyToken(token);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Session expired, please log in again.",
        });
    }

    try {
        const user = await userManager.findById(payload.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account does not exist.",
            });
        }

        req.user = userManager.toPublicUser(user);
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error, please try again.",
        });
    }
}

// Middleware: optional — attaches req.user when the token is valid,
// no error when missing (for public routes that want
// personalization when the user is logged in).
async function optionalAuth(req, _res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (token) {
        try {
            const payload = verifyToken(token);
            const user = await userManager.findById(payload.sub);
            if (user) req.user = userManager.toPublicUser(user);
        } catch {
            // ignore bad tokens on optional routes
        }
    }

    next();
}

module.exports = {
    signToken,
    verifyToken,
    requireAuth,
    optionalAuth,
};
