// =====================================================
// JWT helpers + auth middleware
//
// - Token ký bằng JWT_SECRET (env), hết hạn sau 7 ngày.
// - Client gửi: Authorization: Bearer <token>
// - Middleware gắn req.user (public shape, không có passwordHash).
// =====================================================

const jwt = require("jsonwebtoken");
const userManager = require("../managers/userManager");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const JWT_EXPIRES_IN = "7d";

if (!process.env.JWT_SECRET) {
    console.warn(
        "[auth] JWT_SECRET chưa được set — đang dùng secret mặc định, " +
            "chỉ phù hợp cho môi trường dev."
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

// Middleware: bắt buộc đăng nhập
async function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Bạn cần đăng nhập.",
        });
    }

    let payload;
    try {
        payload = verifyToken(token);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.",
        });
    }

    try {
        const user = await userManager.findById(payload.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản không tồn tại.",
            });
        }

        req.user = userManager.toPublicUser(user);
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi server, vui lòng thử lại.",
        });
    }
}

// Middleware: optional — gắn req.user nếu có token hợp lệ,
// không báo lỗi nếu không có (dùng cho route public muốn
// personal hoá khi user đã login).
async function optionalAuth(req, _res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (token) {
        try {
            const payload = verifyToken(token);
            const user = await userManager.findById(payload.sub);
            if (user) req.user = userManager.toPublicUser(user);
        } catch {
            // bỏ qua token hỏng ở route optional
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
