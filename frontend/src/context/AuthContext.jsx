// AuthContext.jsx - quản lý trạng thái đăng nhập toàn app
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "pokemon_auth_token";

const AuthContext = createContext(null);

async function api(path, { method = "GET", body, token } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === false) {
        throw new Error(json.message || "Có lỗi xảy ra, vui lòng thử lại.");
    }

    return json;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    }, []);

    // Khi có token (F5 hoặc vừa login), lấy lại thông tin user
    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        api("/api/auth/me", { token })
            .then((json) => {
                if (!cancelled) setUser(json.user);
            })
            .catch(() => {
                if (!cancelled) logout(); // token hỏng/hết hạn
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [token, logout]);

    const saveSession = useCallback((json) => {
        localStorage.setItem(TOKEN_KEY, json.token);
        setToken(json.token);
        setUser(json.user);
    }, []);

    const login = useCallback(
        async (email, password) => {
            const json = await api("/api/auth/login", {
                method: "POST",
                body: { email, password },
            });
            saveSession(json);
            return json.user;
        },
        [saveSession]
    );

    const register = useCallback(
        async (name, email, password) => {
            const json = await api("/api/auth/register", {
                method: "POST",
                body: { name, email, password },
            });
            saveSession(json);
            return json.user;
        },
        [saveSession]
    );

    return (
        <AuthContext.Provider
            value={{ user, token, loading, login, register, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth phải dùng trong <AuthProvider>");
    return ctx;
}

// Helper: header Authorization cho các fetch cần đăng nhập
export function authHeader() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
}
