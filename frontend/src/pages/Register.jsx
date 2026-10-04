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
            setError("Passwords do not match.");
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
                    <h1 className="auth-title">Sign Up</h1>
                    <p className="auth-sub">Create an account to save scores and climb the leaderboard.</p>

                    <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
                        <div className="form-group">
                            <label className="form-label" htmlFor="regName">Display Name</label>
                            <input
                                id="regName"
                                className="form-input"
                                type="text"
                                placeholder="Your name..."
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
                                Password (min. 6 characters)
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
                            <label className="form-label" htmlFor="regConfirm">Confirm Password</label>
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
                            {loading ? "Signing up..." : "Sign Up"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Log in</Link>
                    </p>
                </div>
            </div>
        </>
    );
}

export default Register;
