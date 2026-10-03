// Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../css/Auth.css";

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(email, password);
            navigate("/");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="bg-layer" aria-hidden="true">
                <div className="radial-glow"></div>
                <div className="radial-glow-2"></div>
            </div>

            <div className="auth-container">
                <div className="auth-card">
                    <h1 className="auth-title">Đăng nhập</h1>
                    <p className="auth-sub">Chào mừng quay lại, nhà huấn luyện!</p>

                    <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
                        <div className="form-group">
                            <label className="form-label" htmlFor="loginEmail">Email</label>
                            <input
                                id="loginEmail"
                                className="form-input"
                                type="email"
                                placeholder="ban@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="loginPassword">Mật khẩu</label>
                            <input
                                id="loginPassword"
                                className="form-input"
                                type="password"
                                placeholder="••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="auth-error">{error}</p>}

                        <button type="submit" className="btn-primary btn-auth" disabled={loading}>
                            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
                    </p>
                </div>
            </div>
        </>
    );
}

export default Login;
