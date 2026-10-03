// Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../css/Auth.css";

function Register() {
    const navigate = useNavigate();
    const { register } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (password !== confirm) {
            setError("Mật khẩu nhập lại không khớp.");
            return;
        }

        setLoading(true);

        try {
            await register(name, email, password);
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
                    <h1 className="auth-title">Đăng ký</h1>
                    <p className="auth-sub">Tạo tài khoản để lưu điểm và lên bảng xếp hạng.</p>

                    <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
                        <div className="form-group">
                            <label className="form-label" htmlFor="regName">Tên hiển thị</label>
                            <input
                                id="regName"
                                className="form-input"
                                type="text"
                                placeholder="Tên của bạn..."
                                maxLength="20"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="regEmail">Email</label>
                            <input
                                id="regEmail"
                                className="form-input"
                                type="email"
                                placeholder="ban@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="regPassword">
                                Mật khẩu (tối thiểu 6 ký tự)
                            </label>
                            <input
                                id="regPassword"
                                className="form-input"
                                type="password"
                                placeholder="••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="regConfirm">Nhập lại mật khẩu</label>
                            <input
                                id="regConfirm"
                                className="form-input"
                                type="password"
                                placeholder="••••••"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="auth-error">{error}</p>}

                        <button type="submit" className="btn-primary btn-auth" disabled={loading}>
                            {loading ? "Đang đăng ký..." : "Đăng ký"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                    </p>
                </div>
            </div>
        </>
    );
}

export default Register;
