// =====================================================
// Auth routes (Express REST)
// Base: /api/auth
//
// - POST /register { name, email, password } -> 201 { token, user }
// - POST /login    { email, password }       -> 200 { token, user }
// - GET  /me       (Bearer token)            -> 200 { user }
// =====================================================

const express = require("express");
const router = express.Router();

const userManager = require("../managers/userManager");
const { signToken, requireAuth } = require("../middleware/authMiddleware");

function authResponse(user) {
    return {
        success: true,
        token: signToken(user),
        user: userManager.toPublicUser(user),
    };
}

// Đăng ký
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body || {};
        const user = await userManager.createUser({ name, email, password });

        // createUser trả về public shape; cần full user để ký token
        const full = await userManager.findById(user.id);

        res.status(201).json(authResponse(full));
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Đăng nhập
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        const user = await userManager.findByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng.",
            });
        }

        const ok = await userManager.verifyPassword(user, password);

        if (!ok) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng.",
            });
        }

        res.json(authResponse(user));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Lấy thông tin user hiện tại
router.get("/me", requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
});

module.exports = router;
